import { Router } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export function createAdminStaticPagesRouter({
  query,
  config,
  upload,
  staticPageSchema,
  parseStaticPageBoxes,
  parseStaticPageDescriptionBlocks,
  staticPageColumns,
  staticPageSelect,
  serializeStaticPage,
  staticPageBoxImages,
  staticPageDescriptionBlocks,
  shiftStaticPageOrders,
  saveStaticPageBoxes,
  saveStaticPageDescriptionBlocks,
  useLegacyStaticPages,
  uploadedFile,
  safeFilename,
  slugify,
}) {
  const router = Router();
  router.get("/api/static-pages", async (_req, res, next) => {
    try {
      const result = await query(
        `${staticPageSelect()} ORDER BY parent_id ASC, display_order ASC, id ASC`,
      );
      const pages = await Promise.all(
        result.rows.map(async (row) => ({
          ...serializeStaticPage(row),
          box_images: await staticPageBoxImages(row.id),
          description_blocks: await staticPageDescriptionBlocks(row.id),
        })),
      );
      res.json(pages);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/static-pages", upload.any(), async (req, res, next) => {
    try {
      const data = staticPageSchema.parse(req.body);
      const boxes = parseStaticPageBoxes(req.body.box_images);
      const descriptionBlocks =
        data.description_type === "new_description"
          ? parseStaticPageDescriptionBlocks(req.body.description_blocks)
          : [];
      const columns = staticPageColumns();
      const duplicate = await query(
        `SELECT 1 FROM ${columns.table} WHERE LOWER(${columns.name}) = LOWER($1) LIMIT 1`,
        [data.name],
      );
      if (duplicate.rowCount)
        return res.status(409).json({
          message: "Sorry, name is already added. Please use another name.",
        });
      const banner = uploadedFile(req.files, "banner_image");
      const filename = banner ? safeFilename(banner, "static-page") : "";
      if (banner)
        await fs.rename(
          banner.path,
          path.join(config.staticPageUploadDir, filename),
        );
      const slug = slugify(data.slug || data.name);
      await shiftStaticPageOrders(data.parent_id, data.display_order, "up");
      const result = useLegacyStaticPages()
        ? await query(
            `INSERT INTO alpenwild_static_page_tbl
               (static_page_display_as_page, static_page_parent_id, static_page_name,
                static_page_slug, static_page_menu_name, static_page_menu_assign,
                static_page_social_sharing_display, static_page_meta_title,
                static_page_meta_descriptions, static_page_meta_keywords,
                static_page_description, static_page_banner_title,
                static_page_banner_sub_title, static_page_tooltip_text,
                static_page_description_type, static_page_banner, static_page_order,
                static_page_status)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
               RETURNING ${staticPageSelect()
                 .replace(/^SELECT /, "")
                 .replace(/ FROM alpenwild_static_page_tbl$/, "")}`,
            [
              data.display_as_page,
              data.parent_id,
              data.name,
              slug,
              data.menu_name,
              data.menu_assign,
              data.social_sharing_display,
              data.meta_title,
              data.meta_descriptions,
              data.meta_keywords,
              data.description,
              data.banner_title,
              data.banner_sub_title,
              data.tooltip_text,
              data.description_type,
              filename,
              data.display_order,
              data.status,
            ],
          )
        : await query(
            `INSERT INTO static_pages
               (display_as_page,parent_id,name,slug,menu_name,menu_assign,social_sharing_display,
                meta_title,meta_descriptions,meta_keywords,description,banner_title,banner_sub_title,
                tooltip_text,description_type,banner_image,display_order,status)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
               RETURNING *`,
            [
              data.display_as_page,
              data.parent_id,
              data.name,
              slug,
              data.menu_name,
              data.menu_assign,
              data.social_sharing_display,
              data.meta_title,
              data.meta_descriptions,
              data.meta_keywords,
              data.description,
              data.banner_title,
              data.banner_sub_title,
              data.tooltip_text,
              data.description_type,
              filename,
              data.display_order,
              data.status,
            ],
          );
      const pageId = result.rows[0].id;
      await saveStaticPageBoxes(
        pageId,
        boxes,
        req.files,
        req.body.box_images !== undefined,
      );
      if (data.description_type === "new_description")
        await saveStaticPageDescriptionBlocks(
          pageId,
          descriptionBlocks,
          req.files,
        );
      res.status(201).json({
        ...serializeStaticPage(result.rows[0]),
        box_images: await staticPageBoxImages(pageId),
        description_blocks: await staticPageDescriptionBlocks(pageId),
      });
    } catch (error) {
      next(error);
    }
  });

  router.patch(
    "/api/static-pages/:id",
    upload.any(),
    async (req, res, next) => {
      try {
        const data = staticPageSchema.parse(req.body);
        const boxes = parseStaticPageBoxes(req.body.box_images);
        const descriptionBlocks =
          data.description_type === "new_description"
            ? parseStaticPageDescriptionBlocks(req.body.description_blocks)
            : [];
        const columns = staticPageColumns();
        const duplicate = await query(
          `SELECT 1 FROM ${columns.table} WHERE LOWER(${columns.name}) = LOWER($1) AND ${columns.id} <> $2 LIMIT 1`,
          [data.name, req.params.id],
        );
        if (duplicate.rowCount)
          return res.status(409).json({
            message: "Sorry, name is already added. Please use another name.",
          });
        const currentResult = await query(
          `${staticPageSelect()} WHERE ${columns.id} = $1`,
          [req.params.id],
        );
        if (!currentResult.rowCount)
          return res.status(404).json({ message: "Static page not found." });
        const current = currentResult.rows[0];
        const banner = uploadedFile(req.files, "banner_image");
        const filename = banner ? safeFilename(banner, "static-page") : null;
        if (banner)
          await fs.rename(
            banner.path,
            path.join(config.staticPageUploadDir, filename),
          );
        if (current.parent_id === data.parent_id) {
          if (data.display_order < current.display_order)
            await query(
              `UPDATE ${columns.table} SET ${columns.order}=${columns.order}+1
               WHERE ${columns.parent}=$1 AND ${columns.order}>=$2 AND ${columns.order}<$3 AND ${columns.id}<>$4`,
              [
                data.parent_id,
                data.display_order,
                current.display_order,
                req.params.id,
              ],
            );
          else if (data.display_order > current.display_order)
            await query(
              `UPDATE ${columns.table} SET ${columns.order}=${columns.order}-1
               WHERE ${columns.parent}=$1 AND ${columns.order}>$2 AND ${columns.order}<=$3 AND ${columns.id}<>$4`,
              [
                data.parent_id,
                current.display_order,
                data.display_order,
                req.params.id,
              ],
            );
        } else {
          await query(
            `UPDATE ${columns.table} SET ${columns.order}=${columns.order}-1
             WHERE ${columns.parent}=$1 AND ${columns.order}>$2 AND ${columns.id}<>$3`,
            [current.parent_id, current.display_order, req.params.id],
          );
          await shiftStaticPageOrders(
            data.parent_id,
            data.display_order,
            "up",
            req.params.id,
          );
        }
        const values = [
          data.display_as_page,
          data.parent_id,
          data.name,
          slugify(data.slug || data.name),
          data.menu_name,
          data.menu_assign,
          data.social_sharing_display,
          data.meta_title,
          data.meta_descriptions,
          data.meta_keywords,
          data.description,
          data.banner_title,
          data.banner_sub_title,
          data.tooltip_text,
          data.description_type,
          filename,
          data.display_order,
          data.status,
          req.params.id,
        ];
        const result = useLegacyStaticPages()
          ? await query(
              `UPDATE alpenwild_static_page_tbl SET static_page_display_as_page=$1,
               static_page_parent_id=$2,static_page_name=$3,static_page_slug=$4,
               static_page_menu_name=$5,static_page_menu_assign=$6,
               static_page_social_sharing_display=$7,static_page_meta_title=$8,
               static_page_meta_descriptions=$9,static_page_meta_keywords=$10,
               static_page_description=$11,static_page_banner_title=$12,
               static_page_banner_sub_title=$13,static_page_tooltip_text=$14,
               static_page_description_type=$15,static_page_banner=COALESCE($16,static_page_banner),
               static_page_order=$17,static_page_status=$18 WHERE static_page_id=$19
               RETURNING ${staticPageSelect()
                 .replace(/^SELECT /, "")
                 .replace(/ FROM alpenwild_static_page_tbl$/, "")}`,
              values,
            )
          : await query(
              `UPDATE static_pages SET display_as_page=$1,parent_id=$2,name=$3,slug=$4,
               menu_name=$5,menu_assign=$6,social_sharing_display=$7,meta_title=$8,
               meta_descriptions=$9,meta_keywords=$10,description=$11,banner_title=$12,
               banner_sub_title=$13,tooltip_text=$14,description_type=$15,
               banner_image=COALESCE($16,banner_image),display_order=$17,status=$18,
               updated_at=NOW() WHERE id=$19 RETURNING *`,
              values,
            );
        await saveStaticPageBoxes(
          req.params.id,
          boxes,
          req.files,
          req.body.box_images !== undefined,
        );
        if (data.description_type === "new_description")
          await saveStaticPageDescriptionBlocks(
            req.params.id,
            descriptionBlocks,
            req.files,
          );
        res.json({
          ...serializeStaticPage(result.rows[0]),
          box_images: await staticPageBoxImages(req.params.id),
          description_blocks: await staticPageDescriptionBlocks(req.params.id),
        });
      } catch (error) {
        next(error);
      }
    },
  );

  router.patch("/api/static-pages/:id/status", async (req, res, next) => {
    try {
      const status = z.enum(["Active", "Inactive"]).parse(req.body.status);
      const columns = staticPageColumns();
      const result = await query(
        `UPDATE ${columns.table} SET ${useLegacyStaticPages() ? "static_page_status" : "status"}=$1
         WHERE ${columns.id}=$2 RETURNING ${staticPageSelect()
           .replace(/^SELECT /, "")
           .replace(/ FROM (alpenwild_static_page_tbl|static_pages)$/, "")}`,
        [status, req.params.id],
      );
      if (!result.rowCount)
        return res.status(404).json({ message: "Static page not found." });
      res.json(serializeStaticPage(result.rows[0]));
    } catch (error) {
      next(error);
    }
  });

  router.delete("/api/static-pages/:id", async (req, res, next) => {
    try {
      const columns = staticPageColumns();
      const existing = await query(
        `${staticPageSelect()} WHERE ${columns.id}=$1`,
        [req.params.id],
      );
      if (!existing.rowCount)
        return res.status(404).json({ message: "Static page not found." });
      const children = await query(
        `SELECT 1 FROM ${columns.table} WHERE ${columns.parent}=$1 LIMIT 1`,
        [req.params.id],
      );
      if (children.rowCount)
        return res.status(409).json({
          message:
            "Child page existing under this static page. First delete child page and then delete this static page.",
        });
      const result = await query(
        `DELETE FROM ${columns.table} WHERE ${columns.id}=$1 RETURNING ${columns.id}`,
        [req.params.id],
      );
      await query(
        `UPDATE ${columns.table} SET ${columns.order}=${columns.order}-1
         WHERE ${columns.parent}=$1 AND ${columns.order}>$2`,
        [existing.rows[0].parent_id, existing.rows[0].display_order],
      );
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
