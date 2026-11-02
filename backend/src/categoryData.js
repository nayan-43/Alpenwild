export function createCategoryDataHelpers({ query, config }) {
  function categorySelect() {
    return `SELECT category_id AS id, category_parent_id AS parent_id,
      category_name AS name, category_slug AS slug,
      category_menu_name AS menu_name, category_meta_title AS meta_title,
      category_meta_keywords AS meta_keywords,
      category_meta_descriptions AS meta_descriptions,
      category_description AS description, category_banner AS banner_image,
      category_banner_title AS banner_title,
      category_banner_sub_title AS banner_sub_title,
      category_tooltip_text AS tooltip_text,
      category_listing_image AS listing_image,
      category_order AS display_order, category_status AS status
      FROM alpenwild_category_tbl`;
  }

  function serializeCategory(row) {
    const imageUrl = (filename, folder) =>
      filename
        ? `/uploads/${config.categoryUploadSubdir}/${folder}/${encodeURIComponent(filename)}`
        : null;
    return {
      ...row,
      banner_image_url: imageUrl(row.banner_image, "banner"),
      listing_image_url: imageUrl(row.listing_image, "listing"),
      box_images: (row.box_images || []).map((box) => ({
        ...box,
        image_url: imageUrl(box.image, "boximage"),
      })),
    };
  }

  async function categoryBoxImagesFor(categoryIds) {
    if (!categoryIds.length) return new Map();
    const result = await query(
      `SELECT category_box_image_id AS id, category_id, category_box_image AS image,
        category_box_image_title AS title, category_box_image_link AS link
       FROM alpenwild_category_box_image_tbl
       WHERE category_id = ANY($1::int[]) ORDER BY category_box_image_id ASC`,
      [categoryIds],
    );
    const grouped = new Map();
    for (const row of result.rows) {
      if (!grouped.has(row.category_id)) grouped.set(row.category_id, []);
      grouped.get(row.category_id).push(row);
    }
    return grouped;
  }

  return { categorySelect, serializeCategory, categoryBoxImagesFor };
}
