import {
  createNavigationContainerRef,
  type ParamListBase,
} from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef<ParamListBase>();

export function navigate(name: string, params?: Record<string, unknown>) {
  if (navigationRef.isReady()) {
    // @ts-ignore - navigationRef.navigate requires specific type, but we use dynamic navigation
    navigationRef.navigate(name, params);
  }
}
