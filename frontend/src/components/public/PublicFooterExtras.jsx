import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { localAssetUrl } from "@/lib/assets";
import { submitNewsletterForm } from "@/lib/publicForms";
import { RECAPTCHA_SITE_KEY } from "@/lib/recaptcha";
import $ from "@/vendor/jqueryValidationEngine";

export default function PublicFooterExtras({ publicSettings = {} }) {
  const navigate = useNavigate();
  const newsletterFormRef = useRef(null);
  const [formState, setFormState] = useState({
    busy: false,
    message: "",
    error: "",
  });

  useEffect(() => {
    const form = newsletterFormRef.current;
    if (!form) return undefined;
    const $form = $(form);
    $form.validationEngine("attach", { promptPosition: "topLeft" });
    return () => {
      $form.validationEngine("hideAll");
      $form.validationEngine("detach");
    };
  }, []);

  async function submitNewsletter(event) {
    event.preventDefault();
    const form = event.currentTarget;
    if (formState.busy || !$(form).validationEngine("validate")) return;
    setFormState({ busy: true, message: "", error: "" });
    try {
      await submitNewsletterForm(form);
      form.reset();
      window.grecaptcha?.reset?.();
      setFormState({ busy: false, message: "", error: "" });
      navigate("/staticpage/thank-you-for-subscribing/");
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    } catch (error) {
      setFormState({ busy: false, message: "", error: error.message });
    }
  }

  useEffect(() => {
    if (import.meta.env.VITE_ENABLE_RECAPTCHA === "false") return undefined;
    const renderCaptcha = () => {
      if (!window.grecaptcha?.render) return;
      document.querySelectorAll(".g-recaptcha").forEach((element) => {
        if (!element.querySelector("iframe") && !element.dataset.rendered) {
          const widgetId = window.grecaptcha.render(element, {
            sitekey: element.dataset.sitekey,
          });
          element.dataset.widgetId = String(widgetId);
          element.dataset.rendered = "true";
        }
      });
    };
    const existingScript = document.querySelector(
      'script[data-recaptcha="google"]',
    );
    const script = existingScript || document.createElement("script");
    if (!existingScript) {
      script.src = "https://www.google.com/recaptcha/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.recaptcha = "google";
      document.head.appendChild(script);
    }
    let attempts = 0;
    const timer = window.setInterval(() => {
      renderCaptcha();
      attempts += 1;
      if (window.grecaptcha?.render || attempts >= 100) {
        window.clearInterval(timer);
      }
    }, 100);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <>
      <div className="section footer_logo_section">
        <div className="container">
          <div className="row footer_top_align">
            <div className="col-md-8 col-sm-12 col-xs-12 client_logo">
              <ul>
                {[
                  ["footer_image_one", "footer_image_one_url"],
                  ["footer_image_two", "footer_image_two_url"],
                  ["footer_image_three", "footer_image_three_url"],
                  ["footer_image_four", "footer_image_four_url"],
                ].map(([imageKey, linkKey]) => {
                  const image = publicSettings[imageKey];
                  if (!image) return null;
                  const element = <img src={localAssetUrl(image)} alt="" />;
                  return (
                    <li key={imageKey}>
                      {publicSettings[linkKey] ? (
                        <a
                          href={publicSettings[linkKey]}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {element}
                        </a>
                      ) : (
                        element
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="col-md-4 col-sm-12 col-xs-12 social_logo">
              Get in Touch:
              <ul>
                {[
                  ["fa-facebook-square", "http://bit.ly/2KYgdVF"],
                  ["fa-youtube-square", "http://bit.ly/2ZuROuJ"],
                  ["fa-flickr", "https://www.flickr.com/photos/alpenwild"],
                  ["fa-pinterest", "http://bit.ly/2MBe1pt"],
                  ["fa-twitter", "http://bit.ly/2Fi8uhv"],
                  ["fa-instagram", "http://bit.ly/2XlV4Lx"],
                ].map(([icon, href]) => (
                  <li key={icon}>
                    <a href={href} target="_blank" rel="noreferrer">
                      <i className={`fa ${icon}`} />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
      <section
        id="newsletter"
        className="section newsletter-signup text-center"
      >
        <div className="container">
          <div className="clearfix">
            <h3>Sign Up for Our Email Newsletter</h3>
            <p>
              Stay up to date on the latest Alpenwild news. You&apos;re free to
              opt out at any time. See our{" "}
              <Link to="/staticpage/privacy-policy/">Privacy Policy</Link>.
            </p>
            <form
              ref={newsletterFormRef}
              className="form-horizontal"
              noValidate
              onSubmit={submitNewsletter}
            >
              <div className="clearfix row">
                <div className="col-xs-12 col-sm-4">
                  <div className="clearfix">
                    <input
                      type="text"
                      name="first_name"
                      placeholder="First Name"
                      className="form-control"
                      data-validation-engine="validate[required]"
                    />
                  </div>
                </div>
                <div className="col-xs-12 col-sm-4">
                  <div className="clearfix">
                    <input
                      type="text"
                      name="last_name"
                      placeholder="Last Name"
                      className="form-control"
                      data-validation-engine="validate[required]"
                    />
                  </div>
                </div>
                <div className="col-xs-12 col-sm-4">
                  <div className="clearfix">
                    <input
                      type="text"
                      name="email_address"
                      placeholder="Email Address"
                      className="form-control"
                      data-validation-engine="validate[required,custom[email]]"
                    />
                  </div>
                </div>
                <div className="col-xs-12 col-sm-12 text-left">
                  <div className="clearfix chkwrap newsletter-interests">
                    <span className="flabel">
                      <strong>Interests: </strong>
                    </span>
                    <span className="checkbox">
                      <input
                        type="checkbox"
                        name="news_signup1"
                        value="Interests – Hiking and trekking"
                        id="news_signup1"
                      />
                      <label htmlFor="news_signup1">Hiking and trekking</label>
                    </span>
                    <span className="checkbox">
                      <input
                        type="checkbox"
                        name="news_signup2"
                        value="Interests – Cultural and gourmet"
                        id="news_signup2"
                      />
                      <label htmlFor="news_signup2">Cultural and gourmet</label>
                    </span>
                    <span className="checkbox">
                      <input
                        type="checkbox"
                        name="news_signup3"
                        value="Interests – Ski and winter"
                        id="news_signup3"
                      />
                      <label htmlFor="news_signup3">Ski and winter</label>
                    </span>
                  </div>
                </div>
                <input type="hidden" name="form_id" value="" />
                <input type="hidden" name="site_name" value="Alpenwild" />
                <input
                  type="hidden"
                  name="site_tagline"
                  value="Alpine Adventures. Perfected"
                />
                <div className="col-xs-12 col-sm-12 text-left">
                  <div className="clearfix chkwrap">
                    <div className="form_holder clearfix">
                      <div
                        className="g-recaptcha"
                        data-sitekey={RECAPTCHA_SITE_KEY}
                      />
                    </div>
                  </div>
                </div>
                <div className="col-xs-12 col-sm-12">
                  {formState.error && (
                    <p className="client-form-error" role="alert">
                      {formState.error}
                    </p>
                  )}
                  {formState.message && (
                    <p className="client-form-success" role="status">
                      {formState.message}
                    </p>
                  )}
                  <button
                    type="submit"
                    name="button"
                    value="Submit"
                    className="btn btn-default"
                    disabled={formState.busy}
                  >
                    <i className="fa fa-paper-plane" />{" "}
                    {formState.busy ? "Submitting..." : "Subscribe"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </section>
    </>
  );
}
