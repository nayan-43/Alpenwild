import React from "react";
import { Link } from "react-router-dom";
import { localAppLink, localAssetUrl } from "@/lib/assets";

export default function PublicFooter({ footerMenus }) {
  const groups = [
    "Blogs",
    "WhatNew",
    "NecessaryInfo",
    "HappyGuests",
    "AlpenwildRecommended",
  ].map((under) => ({
    under,
    title:
      under === "WhatNew"
        ? "What’s New?"
        : under.replace(/([A-Z])/g, " $1").trim(),
    items: footerMenus.filter(
      (item) => item.status === "Active" && item.under === under,
    ),
  }));

  return (
    <footer>
      <div className="container">
        <div className="row">
          <div className="col-md-2 col-sm-2 col-xs-12">
            <Link to="/">
              <img src={localAssetUrl("footer_logo2.png")} alt="" />
            </Link>
          </div>
          <div className="col-md-10 col-sm-10 col-xs-12 fooler_link">
            <div className="clearfix row">
              {groups.slice(0, 3).map((group) => (
                <div
                  className="col-xs-12 col-sm-4 fooler_link"
                  key={group.under}
                >
                  <h4>{group.title}</h4>
                  <ul>
                    {group.items.map((item) => (
                      <li key={item.id}>
                        {renderFooterLink(item)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="clearfix row">
              {groups.slice(3).map((group) => (
                <div
                  className="col-xs-12 col-sm-4 fooler_link"
                  key={group.under}
                >
                  <h4>{group.title}</h4>
                  <ul>
                    {group.items.map((item) => (
                      <li key={item.id}>
                        {renderFooterLink(item)}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
          <div className="col-xs-12 text-center">
            <div className="copy">
              Copyright &copy; 2005-{new Date().getFullYear()} alpenwild.com.
              All rights reserved
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

function renderFooterLink(item) {
  const link = String(item.link || "");
  const localLink = localAppLink(link);
  if (localLink) return <Link to={localLink}>{item.title}</Link>;
  return (
    <a
      href={link}
      target={item.link_target === "_blank" ? "_blank" : undefined}
      rel={item.link_target === "_blank" ? "noreferrer" : undefined}
    >
      {item.title}
    </a>
  );
}
