import { useEffect, useState } from "react";

interface NetInfo {
  effectiveType?: string;
  type?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  addEventListener?: (e: string, cb: () => void) => void;
  removeEventListener?: (e: string, cb: () => void) => void;
}

export interface ConnectionState {
  supported: boolean;
  online: boolean;
  effectiveType?: string;
  type?: string;
  downlink?: number;
  rtt?: number;
}

function read(): ConnectionState {
  const c = (navigator as unknown as { connection?: NetInfo }).connection;
  return {
    supported: !!c,
    online: navigator.onLine,
    effectiveType: c?.effectiveType,
    type: c?.type,
    downlink: c?.downlink,
    rtt: c?.rtt,
  };
}

/** قراءة معلومات اتصال الجهاز الحالي (Network Information API) */
export function useConnection(): ConnectionState {
  const [state, setState] = useState<ConnectionState>(read);
  useEffect(() => {
    const c = (navigator as unknown as { connection?: NetInfo }).connection;
    const update = () => setState(read());
    c?.addEventListener?.("change", update);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      c?.removeEventListener?.("change", update);
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return state;
}
