import React from "react";
import Icon from "./Icon";

export default function Topbar({ user, onLogout }) {
  function toggleSidebar() {
    if (window.innerWidth <= 767) {
      document.body.classList.toggle("sidebar-open");
      return;
    }
    document.body.classList.toggle("sidebar-collapsed");
  }

  return (
    <header className="topbar">
      <button
        className="menu-button"
        onClick={toggleSidebar}
        aria-label="Toggle navigation"
      >
        <Icon name="menu" />
      </button>
      <span className="topbar-title">Alpenwild Administration</span>
      <div className="admin-user">
        {/* <span>
          <Icon name="user" size={14} /> {user?.display_name || "Administrator"}
        </span> */}
        {/* <button type="button" className="logout-button" onClick={onLogout}>
          Logout
        </button> */}
      </div>
    </header>
  );
}
