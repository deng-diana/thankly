import {
  createNavigationContainerRef,
  type ParamListBase,
} from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef<ParamListBase>();

export function navigate(name: string, params?: Record<string, unknown>) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name as never, params as never);
  }
}
