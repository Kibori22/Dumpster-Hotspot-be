// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { SymbolWeight, SymbolViewProps } from "expo-symbols";
import { ComponentProps } from "react";
import { OpaqueColorValue, type StyleProp, type TextStyle } from "react-native";

type IconMapping = Record<SymbolViewProps["name"], ComponentProps<typeof MaterialIcons>["name"]>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 */
const MAPPING = {
  "house.fill": "home",
  "paperplane.fill": "send",
  "chevron.left.forwardslash.chevron.right": "code",
  "chevron.right": "chevron-right",
  // App tabs
  "map.fill": "map",
  "arrow.left.arrow.right": "swap-horiz",
  "chart.bar.fill": "bar-chart",
  "person.fill": "person",
  // General icons
  "plus.circle.fill": "add-circle",
  "star.fill": "star",
  "star": "star-border",
  "location.fill": "location-on",
  "camera.fill": "camera-alt",
  "xmark": "close",
  "magnifyingglass": "search",
  "trash.fill": "delete",
  "pencil": "edit",
  "heart.fill": "favorite",
  "heart": "favorite-border",
  "bubble.left.fill": "chat-bubble",
  "clock.fill": "access-time",
  "checkmark.circle.fill": "check-circle",
  "exclamationmark.circle.fill": "error",
  "arrow.up.right": "open-in-new",
  "gearshape.fill": "settings",
  "arrow.right.square.fill": "logout",
  "photo.fill": "photo",
  "tag.fill": "local-offer",
  "dollarsign.circle.fill": "attach-money",
  "arrow.triangle.2.circlepath": "sync",
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}