import {
  ChevronRight,
  Clipboard,
  CreditCard,
  Download,
  Trophy,
  X,
  Eye,
  Grid3x3GapFill,
  HouseDoorFill,
  Lightbulb,
  LockFill,
  List,
  Map,
  Pencil,
  Person,
  QuestionCircle,
  SortAlphaDown,
  SortAlphaUp,
  ArrowDownUp,
  Trash3,
  ArrowCounterclockwise,
} from "react-bootstrap-icons";

const iconComponents = {
  dashboard: Grid3x3GapFill,
  chevron: ChevronRight,
  home: HouseDoorFill,
  menu: List,
  user: Person,
  edit: Pencil,
  lightbulb: Lightbulb,
  lock: LockFill,
  trash: Trash3,
  question: QuestionCircle,
  map: Map,
  clipboard: Clipboard,
  creditCard: CreditCard,
  undo: ArrowCounterclockwise,
  eye: Eye,
  download: Download,
  trophy: Trophy,
  close: X,
  sort: ArrowDownUp,
  sortUp: SortAlphaUp,
  sortDown: SortAlphaDown,
};

const adminTableIconClasses = {
  edit: "fa-edit",
  status: "fa-lightbulb-o",
  close: "fa-close",
  eye: "fa-eye",
  undo: "fa-undo",
  clipboard: "fa-clipboard",
  bullseye: "fa-bullseye",
  map: "fa-map",
  user: "fa-user",
  question: "fa-question-circle",
  download: "fa-download",
  trophy: "fa-trophy",
};

export default function Icon({ name, size = 15, className = "" }) {
  if (name === "plane" || name === "chevron" || name === "menu") {
    const iconClass = {
      plane: "fa-location-arrow",
      chevron: "fa-angle-left",
      menu: "fa-bars",
    }[name];
    return (
      <i className={`fa ${iconClass} ${className}`.trim()} aria-hidden="true" />
    );
  }
  const IconComponent = iconComponents[name] || QuestionCircle;
  return (
    <IconComponent
      className={`icon ${className}`.trim()}
      size={size}
      aria-hidden="true"
    />
  );
}

export function AdminTableIcon({ name, size = 14, className = "" }) {
  const iconClass = adminTableIconClasses[name];
  if (!iconClass) return null;

  return (
    <i
      className={`fa fa-fw ${iconClass} ${className}`.trim()}
      style={{ fontSize: size }}
      aria-hidden="true"
    />
  );
}
