// Mock state
const listeners: ((event: any) => void)[] = [];

// @tauri-apps/api/core
export async function invoke(cmd: string, args: any): Promise<any> {
  console.log(`[Tauri Mock] invoke: ${cmd}`, args);

  switch (cmd) {
    case "create_session":
      return `mock-session-${Math.random().toString(36).slice(2, 9)}`;
    
    case "write_to_session":
      // Simulate echo
      setTimeout(() => {
        const payload = {
          id: args.id,
          data: args.data === "\r" ? "\r\n$ " : args.data
        };
        
        listeners.forEach(fn => fn({
          event: "session-data",
          payload: payload,
          windowLabel: "main",
          id: 0
        }));
      }, 10);
      return;
      
    case "kill_session":
      console.log(`[Tauri Mock] Killed session ${args.id}`);
      return;
      
    case "resize_session":
      return;
      
    default:
      console.warn(`[Tauri Mock] Unhandled command: ${cmd}`);
      return null;
  }
}

// @tauri-apps/api/event
export async function listen(event: string, handler: (event: any) => void): Promise<() => void> {
  console.log(`[Tauri Mock] listen: ${event}`);
  if (event === "session-data") {
    listeners.push(handler);
    return () => {
      const idx = listeners.indexOf(handler);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }
  return () => {};
}
