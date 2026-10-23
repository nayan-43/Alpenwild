import axios from "axios";

export async function api(path, options) {
  const { body, method = "GET", headers, ...requestOptions } = options || {};

  try {
    const response = await axios({
      url: path,
      method,
      headers,
      data: body,
      withCredentials: true,
      ...requestOptions,
    });
    return response.status === 204 ? null : response.data;
  } catch (error) {
    const code = error.response?.data?.code;
    const requestPath = String(path).split("?")[0];
    if (
      error.response?.status === 401 &&
      requestPath !== "/api/auth/login" &&
      typeof window !== "undefined"
    ) {
      window.dispatchEvent(
        new CustomEvent("admin-session-expired", {
          detail: { expired: code === "ADMIN_SESSION_EXPIRED" },
        }),
      );
    }
    const message =
      error.response?.data?.message || error.message || "Request failed";
    const requestError = new Error(message);
    requestError.field = error.response?.data?.field;
    requestError.code = code;
    requestError.status = error.response?.status;
    throw requestError;
  }
}

export const emptyBanner = {
  title: "",
  sub_heading: "",
  tooltip_text: "",
  link: "",
  image_alt: "",
  button_label: "",
  button_link: "",
  display_order: 1,
  status: "Active",
  image: null,
};
