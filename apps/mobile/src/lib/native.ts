// Native bridges: haptics + status bar + share/download.
// All guarded so the web dev-server never crashes when Capacitor is absent.
// MIT-compatible, written from scratch.

/** Light tick for select / scrub-end / sheet open. */
export async function hapticTick(): Promise<void> {
  try {
    const mod = await import("@capacitor/haptics");
    const Haptics = mod.Haptics;
    if (!Haptics) return;
    const ImpactStyle =
      mod.ImpactStyle ?? ({ Light: "LIGHT" } as Record<string, string>);
    await Haptics.impact({
      style: (ImpactStyle.Light as never) ?? ("LIGHT" as never),
    });
  } catch {
    // No-op on web / when the plugin is unavailable.
  }
}

/** Stronger tick for split / delete. */
export async function hapticHeavy(): Promise<void> {
  try {
    const mod = await import("@capacitor/haptics");
    const Haptics = mod.Haptics;
    if (!Haptics) return;
    const ImpactStyle =
      mod.ImpactStyle ?? ({ Medium: "MEDIUM" } as Record<string, string>);
    await Haptics.impact({
      style: (ImpactStyle.Medium as never) ?? ("MEDIUM" as never),
    });
  } catch {
    // ignore
  }
}

export async function hapticNotify(): Promise<void> {
  try {
    const mod = await import("@capacitor/haptics");
    await mod.Haptics?.notification?.({ type: "SUCCESS" as never });
  } catch {
    // ignore
  }
}

/** Dark status-bar style on mount (native only, guarded). */
export async function setupDarkStatusBar(): Promise<void> {
  try {
    const mod = await import("@capacitor/status-bar");
    const StatusBar = mod.StatusBar;
    if (!StatusBar) return;
    const Style = mod.Style ?? { Dark: "DARK" };
    try {
      await StatusBar.setStyle({ style: Style.Dark as never });
    } catch {
      // ignore
    }
    try {
      await StatusBar.setOverlaysWebView?.({ overlay: true });
    } catch {
      // older platforms may not support overlay
    }
  } catch {
    // Web browser: no status bar plugin.
  }
}

function blobToBase64Data(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = String(r.result ?? "");
      const i = s.indexOf(",");
      resolve(i >= 0 ? s.slice(i + 1) : s);
    };
    r.onerror = () => reject(r.error ?? new Error("base64 encode failed"));
    r.readAsDataURL(blob);
  });
}

/**
 * Share via the native sheet (Capacitor Share + Filesystem) with a
 * browser-download fallback. Returns "shared" | "downloaded".
 */
export async function shareOrDownload(
  blob: Blob,
  fileName: string,
): Promise<"shared" | "downloaded"> {
  try {
    const [{ Share }, { Directory, Filesystem }] = await Promise.all([
      import("@capacitor/share"),
      import("@capacitor/filesystem"),
    ]);
    const data = await blobToBase64Data(blob);
    const written = await Filesystem.writeFile({
      path: fileName,
      data,
      directory: Directory.Cache,
    });
    await Share.share({
      title: "OpenCut export",
      text: "OpenCut export",
      url: written.uri,
      dialogTitle: "Share export",
    });
    return "shared";
  } catch {
    // Browser fallback.
  }
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  return "downloaded";
}
