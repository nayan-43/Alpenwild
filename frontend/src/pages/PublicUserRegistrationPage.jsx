import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import $ from "@/vendor/jqueryValidationEngine";
import PublicFooter from "@/components/public/PublicFooter";
import PublicFooterExtras from "@/components/public/PublicFooterExtras";
import PublicHeader from "@/components/public/PublicHeader";
import PublicLoader from "@/components/public/PublicLoader";
import {
  readShopCheckoutEmail,
  saveShopCheckoutEmail,
} from "@/lib/shopCheckoutEmail";

const blankForm = {
  user_email_address: "",
  user_first_name: "",
  user_last_name: "",
  user_day_phone: "",
  user_mobile_phone: "",
  user_street_address: "",
  user_street_address1: "",
  user_country: "UNITED STATES",
  user_state: "",
  user_city: "",
  user_postal_code: "",
  user_shipping_email_address: "",
  user_shipping_first_name: "",
  user_shipping_last_name: "",
  user_shipping_street_address: "",
  user_shipping_street_address1: "",
  user_shipping_country: "UNITED STATES",
  user_shipping_state: "",
  user_shipping_city: "",
  user_shipping_postal_code: "",
};

const billingFields = [
  ["user_email_address", "Email Address", "email"],
  ["user_first_name", "First Name"],
  ["user_last_name", "Last Name"],
  ["user_day_phone", "Day Phone Number", "tel"],
  ["user_mobile_phone", "Mobile Phone Number", "tel"],
  ["user_street_address", "Street Address"],
  ["user_street_address1", "Street Address 2", "text", false],
  ["user_country", "Country"],
  ["user_state", "State"],
  ["user_city", "City"],
  ["user_postal_code", "Zip Code"],
];

const shippingFields = [
  ["user_shipping_email_address", "Email Address", "email"],
  ["user_shipping_first_name", "First Name"],
  ["user_shipping_last_name", "Last Name"],
  ["user_shipping_street_address", "Street Address"],
  ["user_shipping_street_address1", "Street Address 2", "text", false],
  ["user_shipping_country", "Country"],
  ["user_shipping_state", "State"],
  ["user_shipping_city", "City"],
  ["user_shipping_postal_code", "Zip Code"],
];

function RegistrationField({ field, form, update }) {
  const [name, label, type = "text", required = true] = field;
  return (
    <div className="form_holder">
      <label htmlFor={name}>{label}:</label>
      {name.endsWith("_country") ? (
        <select
          id={name}
          name={name}
          required={required}
          data-validation-engine={required ? "validate[required]" : undefined}
          value={form[name]}
          onChange={(event) => update(name, event.target.value)}
        >
          <option value="UNITED STATES">UNITED STATES</option>
        </select>
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          required={required}
          data-validation-engine={required ? "validate[required]" : undefined}
          autoComplete={
            name.includes("shipping")
              ? name.replace("user_shipping_", "shipping ")
              : name.replace("user_", "")
          }
          value={form[name]}
          onChange={(event) => update(name, event.target.value)}
        />
      )}
    </div>
  );
}

export default function PublicUserRegistrationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const emailFromUrl = searchParams.get("user_email_address") || "";
  const [form, setForm] = useState(() => ({
    ...blankForm,
    user_email_address: emailFromUrl || readShopCheckoutEmail(),
  }));
  const [sameAsBilling, setSameAsBilling] = useState(false);
  const formRef = useRef(null);
  const [footerMenus, setFooterMenus] = useState([]);
  const [publicSettings, setPublicSettings] = useState({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!emailFromUrl) return;
    saveShopCheckoutEmail(emailFromUrl);
    navigate("/user-registration", { replace: true });
  }, [emailFromUrl, navigate]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      fetch("/api/footer-menus").then((response) => response.json()),
      fetch("/api/public-settings").then((response) => response.json()),
    ])
      .then(([menus, settings]) => {
        if (!active) return;
        setFooterMenus(Array.isArray(menus) ? menus : []);
        setPublicSettings(settings || {});
      })
      .catch(() => {
        if (active) setError("Unable to load site footer content.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return undefined;
    const $form = $(form);
    $form.validationEngine("attach", { promptPosition: "topLeft" });
    return () => {
      $form.validationEngine("hideAll");
      $form.validationEngine("detach");
    };
  }, []);

  useEffect(() => {
    document.title = "User Registration | Alpenwild";
    let active = true;
    fetch("/api/public-static-pages")
      .then(async (response) => {
        if (!response.ok)
          throw new Error("Unable to load registration page metadata.");
        return response.json();
      })
      .then((pages) => {
        const title = Array.isArray(pages)
          ? pages.find((page) => Number(page.id) === 1673)?.meta_title
          : "";
        if (active && title) document.title = title;
      })
      .catch((titleError) => {
        if (active) setError(titleError.message);
      });
    return () => {
      active = false;
      document.title = "Alpenwild";
    };
  }, []);

  function update(name, value) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  function updateSameAsBilling(checked) {
    setSameAsBilling(checked);
    if (checked) {
      setForm((current) => ({
        ...current,
        user_shipping_email_address: current.user_email_address,
        user_shipping_first_name: current.user_first_name,
        user_shipping_last_name: current.user_last_name,
        user_shipping_street_address: current.user_street_address,
        user_shipping_street_address1: current.user_street_address1,
        user_shipping_country: current.user_country,
        user_shipping_state: current.user_state,
        user_shipping_city: current.user_city,
        user_shipping_postal_code: current.user_postal_code,
      }));
    }
  }

  async function register(event) {
    event.preventDefault();
    if (busy || !$(event.currentTarget).validationEngine("validate")) return;
    setBusy(true);
    setError("");
    const body = {
      ...form,
      user_preferred_name: form.user_first_name,
      user_date_of_birth: "",
      user_gender: "",
      user_status: "Active",
    };
    try {
      const response = await fetch("/api/public/shop-customer/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(result.message || "Unable to register your account.");
      saveShopCheckoutEmail(form.user_email_address.trim());
      navigate("/checkout", { replace: true });
    } catch (registrationError) {
      setError(registrationError.message);
      setBusy(false);
    }
  }

  return (
    <div className="public-site">
      <PublicHeader />
      {loading && <PublicLoader />}
      <main>
        <section className="section">
          <div className="container">
            <div className="title clearfix">
              <h2>User Registration</h2>
            </div>
            {error && (
              <div className="clearfix client-alert" role="alert">
                {error}
              </div>
            )}
            <div className="clearfix">
              <h4>Enter Your Primary Address.</h4>
            </div>
            <form
              ref={formRef}
              id="user_registration"
              className="form-horizontal"
              onSubmit={register}
            >
              <div className="row clearfix">
                <div className="col-md-6 col-sm-6 col-xs-12">
                  <p>
                    <strong>User Information</strong>
                  </p>
                  {billingFields.map((field) => (
                    <RegistrationField
                      key={field[0]}
                      field={field}
                      form={form}
                      update={update}
                    />
                  ))}
                </div>
                <div className="col-md-6 col-sm-6 col-xs-12">
                  <p>
                    <label>
                      <input
                        type="checkbox"
                        name="same_as_billing"
                        checked={sameAsBilling}
                        onChange={(event) =>
                          updateSameAsBilling(event.target.checked)
                        }
                      />
                    </label>{" "}
                    <strong>Same as billing</strong>
                  </p>
                  {shippingFields.map((field) => (
                    <RegistrationField
                      key={field[0]}
                      field={field}
                      form={form}
                      update={update}
                    />
                  ))}
                </div>
                <div className="col-md-12 col-sm-12 col-xs-12">
                  <button
                    type="submit"
                    className="btn btn-success"
                    disabled={busy}
                  >
                    {busy ? "Submitting…" : "SUBMIT"}
                  </button>{" "}
                </div>
              </div>
            </form>
          </div>
        </section>
      </main>
      <PublicFooterExtras publicSettings={publicSettings} />
      <PublicFooter footerMenus={footerMenus} />
    </div>
  );
}
