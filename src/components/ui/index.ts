/**
 * BugBase UI primitives.
 *
 * Icon-size convention (lucide-react):
 *   - default in body / list items:        w-4 h-4
 *   - inside sm-sized buttons / chips:     w-3.5 h-3.5
 *   - in section headers / empty states:   w-5 h-5
 *
 * Token-only — components never hardcode hex. Colors are wired
 * to the CSS variables defined in src/app/globals.css.
 */

// Form controls
export { Button } from "./Button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./Button";

export { IconButton } from "./IconButton";
export type { IconButtonProps, IconButtonVariant, IconButtonSize } from "./IconButton";

export { Input } from "./Input";
export type { InputProps } from "./Input";

export { Textarea } from "./Textarea";
export type { TextareaProps } from "./Textarea";

export { FieldHelpButton } from "./FieldHelp";
export type { FieldHelpContent, FieldHelpKind } from "./FieldHelp";

export { Select } from "./Select";
export type { SelectProps, SelectOption } from "./Select";

export { MentionSelect } from "./MentionSelect";
export type { MentionSelectProps } from "./MentionSelect";

export { MultiSelectChips } from "./MultiSelectChips";
export type { MultiSelectChipsProps, MultiSelectOption } from "./MultiSelectChips";

export { Checkbox } from "./Checkbox";
export type { CheckboxProps } from "./Checkbox";

export { Switch } from "./Switch";
export type { SwitchProps } from "./Switch";

// Surfaces & layout
export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "./Card";
export type { CardVariant, CardPadding } from "./Card";

export { Divider } from "./Divider";

// Display
export {
  Badge,
  StatusBadge,
  TypeBadge,
  PriorityDot,
  PriorityBadge,
} from "./Badge";
export type { BadgeVariant, BadgeStyle, BadgeSize } from "./Badge";

export { Avatar, AvatarGroup } from "./Avatar";

export { Skeleton } from "./Skeleton";
export type { SkeletonVariant } from "./Skeleton";

export { EmptyState } from "./EmptyState";

export { Kbd } from "./Kbd";

// Overlay
export { Modal } from "./Modal";
export type { ModalSize } from "./Modal";

export { ConfirmDialog } from "./ConfirmDialog";

export { Dropdown, DropdownItem, DropdownSeparator, DropdownLabel } from "./Dropdown";

export { Tooltip } from "./Tooltip";

export { Tabs, TabsList, TabsTrigger, TabsContent } from "./Tabs";

export { ToastProvider, useToast } from "./Toast";
export type { ToastVariant } from "./Toast";

// Feedback / loading
export { Loader, PageLoader, ButtonLoader } from "./Loader";

// FAB
export { FabButton } from "./FabButton";
