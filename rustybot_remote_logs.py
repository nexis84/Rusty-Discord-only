import tkinter as tk
from tkinter import scrolledtext, font
import subprocess
import threading
import queue
import os

class RemoteLogsApp:
    def __init__(self, root):
        self.root = root
        self.root.title("RustyBot Control Center (Oracle Cloud)")
        self.root.geometry("1100x700")
        
        # Color Palette (VS Code style)
        self.colors = {
            "bg_dark": "#181818",
            "bg_panel": "#252526",
            "text_main": "#d4d4d4",
            "text_muted": "#858585",
            "accent": "#007acc",
            "accent_hover": "#005999",
            "success": "#4CAF50",
            "error": "#F44336",
            "warning": "#FF9800"
        }
        
        self.root.configure(bg=self.colors["bg_dark"])
        
        # Define fonts
        self.title_font = font.Font(family="Segoe UI", size=14, weight="bold")
        self.btn_font = font.Font(family="Segoe UI", size=10, weight="bold")
        self.log_font = font.Font(family="Consolas", size=11)
        
        # SSH config
        self.base_dir = os.path.dirname(os.path.abspath(__file__))
        self.key_path = os.path.join(self.base_dir, "keys", "ssh-key-2026-03-22.key")
        self.remote_user = "ubuntu"
        self.remote_ip = "143.47.226.220"

        self.setup_ui()
        
        # Process management
        self.queue = queue.Queue()
        self.process = None
        self.stop_event = threading.Event()
        
        # UI update loop
        self.root.after(100, self.process_queue)
        self.root.protocol("WM_DELETE_WINDOW", self.on_closing)
        
        # Auto-start connection
        self.start_connection()

    def setup_ui(self):
        # 1. Top Control Bar
        self.header = tk.Frame(self.root, bg=self.colors["bg_panel"], height=60)
        self.header.pack(fill=tk.X, side=tk.TOP, pady=(0, 2))
        self.header.pack_propagate(False) # Keep fixed height
        
        # Title
        tk.Label(self.header, text="RustyBot Oracle Link", font=self.title_font, 
                 bg=self.colors["bg_panel"], fg="white").pack(side=tk.LEFT, padx=20)
                 
        # Status Light
        self.status_lbl = tk.Label(self.header, text="⚫ Disconnected", font=self.btn_font, 
                                 bg=self.colors["bg_panel"], fg=self.colors["text_muted"])
        self.status_lbl.pack(side=tk.LEFT, padx=20)

        # Buttons (Right aligned)
        self.btn_restart = tk.Button(self.header, text="🔄 Restart Bot", font=self.btn_font, 
                                     bg="#c74e00", fg="white", activebackground="#a64100", 
                                     activeforeground="white", borderwidth=0, cursor="hand2",
                                     padx=15, pady=5, command=self.restart_bot)
        self.btn_restart.pack(side=tk.RIGHT, padx=20, pady=12)

        self.btn_reconnect = tk.Button(self.header, text="🔌 Reconnect", font=self.btn_font, 
                                       bg=self.colors["accent"], fg="white", activebackground=self.colors["accent_hover"], 
                                       activeforeground="white", borderwidth=0, cursor="hand2",
                                       padx=15, pady=5, command=self.reconnect)
        self.btn_reconnect.pack(side=tk.RIGHT, padx=5, pady=12)

        self.btn_clear = tk.Button(self.header, text="🗑️ Clear", font=self.btn_font, 
                                   bg="#444444", fg="white", activebackground="#333333", 
                                   activeforeground="white", borderwidth=0, cursor="hand2",
                                   padx=15, pady=5, command=self.clear_logs)
        self.btn_clear.pack(side=tk.RIGHT, padx=5, pady=12)

        # 2. Main Log Area
        self.log_area = scrolledtext.ScrolledText(self.root, wrap=tk.WORD, 
                                                  bg=self.colors["bg_dark"], fg=self.colors["text_main"], 
                                                  font=self.log_font, borderwidth=0, highlightthickness=0)
        self.log_area.pack(padx=20, pady=15, fill=tk.BOTH, expand=True)

        # Configure simple syntax coloring tags
        self.log_area.tag_config("error", foreground=self.colors["error"])
        self.log_area.tag_config("warning", foreground=self.colors["warning"])
        self.log_area.tag_config("success", foreground=self.colors["success"])
        self.log_area.tag_config("system", foreground=self.colors["accent"])

    def set_status(self, text, color):
        self.status_lbl.config(text=text, fg=color)

    def append_log(self, text, tag=None):
        self.log_area.insert(tk.END, text, tag)
        self.log_area.see(tk.END)

    def clear_logs(self):
        self.log_area.delete(1.0, tk.END)

    def reconnect(self):
        self.append_log("\n[SYSTEM] Reconnecting...\n", "system")
        if self.process:
            self.stop_connection()
        self.start_connection()

    def restart_bot(self):
        self.append_log("\n[SYSTEM] Sending PM2 restart command to Oracle Cloud...\n", "system")
        threading.Thread(target=self._run_remote_command, args=("pm2 restart rustybot",), daemon=True).start()

    def _run_remote_command(self, remote_cmd):
        cmd = ["ssh", "-i", self.key_path, "-o", "StrictHostKeyChecking=no", f"{self.remote_user}@{self.remote_ip}", remote_cmd]
        hide_console = 0x08000000 if os.name == 'nt' else 0
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, creationflags=hide_console)
            self.queue.put(("system", f"[SYSTEM] Command executed:\n{result.stdout}\n"))
        except Exception as e:
            self.queue.put(("error", f"[SYSTEM ERROR] Failed to run command: {e}\n"))

    def start_connection(self):
        self.stop_event.clear()
        self.set_status("🟢 Streaming Logs", self.colors["success"])
        self.append_log(f"[SYSTEM] Connecting to {self.remote_ip} to stream PM2 logs...\n", "system")
        
        self.read_thread = threading.Thread(target=self.fetch_logs, daemon=True)
        self.read_thread.start()

    def stop_connection(self):
        self.stop_event.set()
        if self.process:
            self.process.terminate()
            if os.name == 'nt':
                subprocess.run(['taskkill', '/F', '/T', '/PID', str(self.process.pid)], 
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            self.process = None

    def fetch_logs(self):
        cmd = [
            "ssh", "-i", self.key_path, "-o", "StrictHostKeyChecking=no",
            f"{self.remote_user}@{self.remote_ip}", "pm2 logs rustybot"
        ]
        
        try:
            hide_console = 0x08000000 if os.name == 'nt' else 0
            self.process = subprocess.Popen(
                cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, 
                text=True, encoding='utf-8', bufsize=1, creationflags=hide_console
            )

            for line in iter(self.process.stdout.readline, ''):
                if self.stop_event.is_set():
                    break
                
                # Determine tag based on content for basic syntax coloring
                tag = None
                line_lower = line.lower()
                if "error" in line_lower or "exception" in line_lower or "❌" in line:
                    tag = "error"
                elif "warn" in line_lower or "⚠️" in line:
                    tag = "warning"
                elif "✅" in line or "ready" in line_lower:
                    tag = "success"
                
                self.queue.put((tag, line))
                
            self.queue.put(("system", "\n[SYSTEM] --- Connection closed by remote server ---\n"))
            self.root.after(0, lambda: self.set_status("🔴 Disconnected", self.colors["error"]))
            
        except Exception as e:
            self.queue.put(("error", f"\n[SYSTEM ERROR] SSH failed:\n{str(e)}\n"))
            self.root.after(0, lambda: self.set_status("🔴 Error", self.colors["error"]))

    def process_queue(self):
        try:
            while True:
                item = self.queue.get_nowait()
                tag, line = item
                self.append_log(line, tag)
        except queue.Empty:
            pass
        finally:
            self.root.after(100, self.process_queue)

    def on_closing(self):
        self.stop_connection()
        self.root.destroy()

if __name__ == "__main__":
    root = tk.Tk()
    app = RemoteLogsApp(root)
    root.mainloop()
