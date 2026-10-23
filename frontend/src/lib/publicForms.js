import { api } from "./api";

async function postPublicForm(path, data) {
  return api(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function submitNewsletterForm(form) {
  const values = new FormData(form);
  return postPublicForm("/api/public/mailing-list", {
    first_name: values.get("first_name"),
    last_name: values.get("last_name"),
    email_address: values.get("email_address"),
    newsletter_signup_option: [
      "news_signup1",
      "news_signup2",
      "news_signup3",
    ]
      .map((name) => values.get(name))
      .filter(Boolean)
      .join("<br>"),
    recaptcha_token: values.get("g-recaptcha-response") || "",
    form_id: values.get("form_id") || "",
  });
}

export function submitCallbackForm(form) {
  const values = new FormData(form);
  return postPublicForm("/api/public/callback", {
    name: values.get("first_name"),
    email: values.get("email"),
    phone_number: values.get("phone_number"),
    best_time: values.get("best_time"),
    question_comments: values.get("question_comments"),
    customer_name: values.get("customer_name") || "",
    recaptcha_token: values.get("g-recaptcha-response") || "",
  });
}
