import React, { useEffect, useState } from "react";
import ModuleTable from "@/components/admin/ModuleTable";
import { api } from "@/lib/api";

const columns = [
  { label: "ID", key: "id" },
  { label: "Title", key: "name" },
  { label: "Code", key: "code" },
  { label: "Type", key: "type" },
  { label: "Value", key: "value" },
  {
    label: "Start Date",
    key: "start_date",
    render: (row) => formatDate(row.start_date),
  },
  {
    label: "End Date",
    key: "end_date",
    render: (row) => formatDate(row.end_date),
  },
  { label: "Status", key: "status" },
];

function formatDate(value, format) {
  if (!value) return "—";
  const datePart = String(value).split("T")[0];
  const date = new Date(`${datePart}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  const [year, month, day] = datePart.split("-").map(Number);
  const paddedDay = String(day).padStart(2, "0");
  const shortMonth = date.toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  const longMonth = date.toLocaleString("en-US", {
    month: "long",
    timeZone: "UTC",
  });
  const shortWeekday = date.toLocaleString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
  const longWeekday = date.toLocaleString("en-US", {
    weekday: "long",
    timeZone: "UTC",
  });
  const ordinal =
    day % 100 >= 11 && day % 100 <= 13
      ? "th"
      : { 1: "st", 2: "nd", 3: "rd" }[day % 10] || "th";
  switch (String(format)) {
    case "1":
      return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    case "2":
      return `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}-${year}`;
    case "3":
      return `${String(day).padStart(2, "0")}-${String(month).padStart(2, "0")}-${year}`;
    case "4":
      return `${paddedDay} ${shortMonth} ${year}`;
    case "5":
      return `${paddedDay} ${longMonth} ${year}`;
    case "6":
      return `${shortMonth} ${paddedDay} ${year}`;
    case "7":
      return `${shortWeekday} ${shortMonth} ${paddedDay}${ordinal}, ${year}`;
    case "8":
      return `${longWeekday} ${shortMonth} ${day}${ordinal}, ${year}`;
    case "9":
      return `${longWeekday} ${longMonth} ${day}${ordinal}, ${year}`;
    case "10":
      return `${paddedDay} ${longMonth} ${year} ${longWeekday}`;
    case "11":
      return `${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}/${year}`;
    default:
      return value;
  }
}

export default function ManageDiscountPage(props) {
  const [dateFormat, setDateFormat] = useState("");
  useEffect(() => {
    let active = true;
    api("/api/settings")
      .then((settings) => {
        if (active) setDateFormat(settings.date_format);
      })
      .catch((error) => props.onError(error.message));
    return () => {
      active = false;
    };
  }, [props.onError]);

  const dateColumns = columns.map((column) =>
    column.key === "start_date" || column.key === "end_date"
      ? {
          ...column,
          render: (row) => formatDate(row[column.key], dateFormat),
        }
      : column,
  );
  return (
    <ModuleTable
      {...props}
      rows={props.items}
      columns={dateColumns}
      initialSortKey="start_date"
      initialSortDirection="desc"
    />
  );
}
