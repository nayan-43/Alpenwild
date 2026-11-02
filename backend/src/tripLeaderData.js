import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const tripLeaderSelect = `SELECT trip_leader_id AS id,
  trip_leader_name AS name, trip_leader_guide_name AS guide_name,
  trip_leader_slug AS slug, trip_leader_meta_title AS meta_title,
  trip_leader_meta_description AS meta_description,
  trip_leader_meta_keywords AS meta_keywords,
  trip_leader_short_descriptions AS short_descriptions,
  trip_leader_type AS type, trip_leader_listing_image AS listing_image,
  trip_leader_order AS display_order, trip_leader_status AS status,
  trip_leader_alps_hiking_author AS alps_hiking_author,
  trip_leader_switzerlandtravel_author AS switzerlandtravel_author,
  trip_leader_myswisskitchennew_author AS myswisskitchennew_author
  FROM alpenwild_trip_leader_tbl`;

export function createTripLeaderSerializer({ config, query }) {
  async function descriptions(id) {
    const result = await query(
      `SELECT description_id AS id,
      description_image, image_ratio, image_proportion, image_width, image_height,
      description_image_align AS image_align,
      description_image_caption AS caption,
      description_image_alt AS image_alt,
      text_wrap, new_description_text AS text, new_description_order AS display_order
      FROM alpenwild_trip_leader_description_tbl WHERE trip_leader_id=$1
      ORDER BY new_description_order, description_id`,
      [id],
    );
    return result.rows.map((row) => ({
      ...row,
      image_url: row.description_image
        ? `/uploads/${config.tripLeaderUploadSubdir}/description/${encodeURIComponent(row.description_image)}`
        : null,
    }));
  }

  return async function serializeTripLeader(row) {
    return {
      ...row,
      listing_image_url: row.listing_image
        ? `/uploads/${config.tripLeaderUploadSubdir}/${encodeURIComponent(row.listing_image)}`
        : null,
      description_blocks: await descriptions(row.id),
    };
  };
}

export function parseTripLeaderDescriptionBlocks(value) {
  if (!value) return [];
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  return z
    .array(
      z.object({
        image: z.string().max(255).default(""),
        text: z.string().max(30000).default(""),
        display_order: z.coerce.number().int().min(0).default(0),
        image_alt: z.string().max(255).default(""),
        caption: z.string().max(255).default(""),
        image_ratio: z.string().max(50).default(""),
        image_proportion: z.enum(["lock", "unlock"]).default("unlock"),
        image_width: z.coerce.number().int().min(0).default(0),
        image_height: z.coerce.number().int().min(0).default(0),
        image_align: z
          .enum(["", "none", "left", "right", "center"])
          .default(""),
        text_wrap: z.enum(["yes", "no"]).default("yes"),
      }),
    )
    .parse(parsed);
}

export async function saveTripLeaderDescriptions(
  { query, config, uploadedFile, safeFilename },
  id,
  blocks,
  files = [],
) {
  await query(
    "DELETE FROM alpenwild_trip_leader_description_tbl WHERE trip_leader_id=$1",
    [id],
  );
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const uploaded = uploadedFile(files, `description_image_${index}`);
    let image = block.image || "";
    if (uploaded) {
      image = safeFilename(uploaded, "leader-description");
      await fs.rename(
        uploaded.path,
        path.join(config.tripLeaderDescriptionUploadDir, image),
      );
    }
    await query(
      `INSERT INTO alpenwild_trip_leader_description_tbl
      (trip_leader_id, description_image, image_ratio, image_proportion,
       image_width, image_height, description_image_align, description_image_caption,
       description_image_alt, text_wrap, new_description_text, new_description_order)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        id,
        image,
        block.image_ratio,
        block.image_proportion,
        block.image_width,
        block.image_height,
        block.image_align,
        block.caption,
        block.image_alt,
        block.text_wrap,
        block.text,
        block.display_order,
      ],
    );
  }
}
