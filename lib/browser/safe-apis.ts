/** Defensive browser API helpers — never throw when unsupported or denied. */

export function safeMatchMedia(query: string): MediaQueryList | null {
  try {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return null;
    }
    return window.matchMedia(query);
  } catch {
    return null;
  }
}

export function isSecureBrowserContext(): boolean {
  try {
    return typeof window !== "undefined" && window.isSecureContext;
  } catch {
    return false;
  }
}

export function canUseGeolocation(): boolean {
  try {
    return (
      typeof navigator !== "undefined" &&
      typeof navigator.geolocation?.getCurrentPosition === "function"
    );
  } catch {
    return false;
  }
}

export type SafePosition = {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
};

export function requestGeolocationPosition(options?: PositionOptions): Promise<SafePosition> {
  return new Promise((resolve, reject) => {
    try {
      if (!isSecureBrowserContext()) {
        reject(new Error("insecure"));
        return;
      }
      if (!canUseGeolocation()) {
        reject(new Error("unsupported"));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
          });
        },
        (error) => reject(error),
        options,
      );
    } catch (error) {
      reject(error instanceof Error ? error : new Error("geolocation_failed"));
    }
  });
}

export function canUseMediaDevices(): boolean {
  try {
    return (
      typeof navigator !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function"
    );
  } catch {
    return false;
  }
}

export async function safeGetUserMedia(
  constraints: MediaStreamConstraints,
): Promise<MediaStream | null> {
  try {
    if (!canUseMediaDevices()) return null;
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch {
    return null;
  }
}

export function canUseNotification(): boolean {
  try {
    return typeof Notification !== "undefined";
  } catch {
    return false;
  }
}

export async function safeRequestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  try {
    if (!canUseNotification() || typeof Notification.requestPermission !== "function") {
      return "unsupported";
    }
    return await Notification.requestPermission();
  } catch {
    return "unsupported";
  }
}

export function getBarcodeDetectorCtor():
  | (new (options?: { formats?: string[] }) => {
      detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
    })
  | null {
  try {
    if (typeof window === "undefined") return null;
    const ctor = (
      window as Window & {
        BarcodeDetector?: new (options?: { formats?: string[] }) => {
          detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue: string }>>;
        };
      }
    ).BarcodeDetector;
    return typeof ctor === "function" ? ctor : null;
  } catch {
    return null;
  }
}
