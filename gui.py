import tkinter as tk
from tkinter import ttk, scrolledtext, messagebox
import subprocess
import os
import threading
import sys
import signal

class BotGUI:
    def __init__(self, root):
        self.root = root
        self.root.title("RustyBot Manager")
        self.root.geometry("800x600")
        self.root.configure(bg="#1e1e2e")
        
        self.processes = []
        self.stop_event = threading.Event()
        
        self.setup_styles()
        self.create_widgets()
        self.load_env()

    def setup_styles(self):
        style = ttk.Style()
        style.theme_use('clam')
        
        # Colors
        self.bg_color = "#1e1e2e"
        self.fg_color = "#cdd6f4"
        self.accent_color = "#89b4fa"
        self.success_color = "#a6e3a1"
        self.error_color = "#f38ba8"
        self.warn_color = "#f9e2af"
        
        style.configure("TFrame", background=self.bg_color)
        style.configure("TLabel", background=self.bg_color, foreground=self.fg_color, font=("Segoe UI", 10))
        style.configure("Header.TLabel", font=("Segoe UI", 16, "bold"), foreground=self.accent_color)
        
        style.configure("TButton", font=("Segoe UI", 10, "bold"), padding=10)
        style.map("TButton",
                  background=[('active', self.accent_color), ('!disabled', "#313244")],
                  foreground=[('!disabled', "white")])
        
        style.configure("StartDiscord.TButton", background="#5865f2")
        style.configure("StartTwitch.TButton", background="#9146ff")
        style.configure("Stop.TButton", background=self.error_color)

    def create_widgets(self):
        # Main Container
        main_frame = ttk.Frame(self.root, padding="20")
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Header
        header_frame = ttk.Frame(main_frame)
        header_frame.pack(fill=tk.X, pady=(0, 20))
        
        ttk.Label(header_frame, text="RustyBot Multi-Platform Manager", style="Header.TLabel").pack(side=tk.LEFT)
        
        self.status_label = ttk.Label(header_frame, text="Status: Ready", foreground=self.success_color)
        self.status_label.pack(side=tk.RIGHT)

        # Controls
        controls_frame = ttk.Frame(main_frame)
        controls_frame.pack(fill=tk.X, pady=10)

        self.btn_discord = ttk.Button(controls_frame, text="Start Discord Only", command=self.start_discord_only)
        self.btn_discord.pack(side=tk.LEFT, padx=5, expand=True, fill=tk.X)

        self.btn_twitch = ttk.Button(controls_frame, text="Start Twitch Only", command=self.start_twitch_only)
        self.btn_twitch.pack(side=tk.LEFT, padx=5, expand=True, fill=tk.X)

        self.btn_both = ttk.Button(controls_frame, text="Start Both Bots", command=self.start_both)
        self.btn_both.pack(side=tk.LEFT, padx=5, expand=True, fill=tk.X)

        self.btn_gatecheck = ttk.Button(controls_frame, text="Start Python Gatecheck", command=self.start_python_gatecheck)
        self.btn_gatecheck.pack(side=tk.LEFT, padx=5, expand=True, fill=tk.X)

        self.btn_stop = ttk.Button(controls_frame, text="Stop All", command=self.stop_bot, state=tk.DISABLED)
        self.btn_stop.pack(side=tk.LEFT, padx=5, expand=True, fill=tk.X)

        # Log Area with Tabs
        log_frame = ttk.Frame(main_frame)
        log_frame.pack(fill=tk.BOTH, expand=True, pady=10)
        
        self.notebook = ttk.Notebook(log_frame)
        self.notebook.pack(fill=tk.BOTH, expand=True)
        
        # Startup Logs Tab
        self.startup_frame = ttk.Frame(self.notebook)
        self.notebook.add(self.startup_frame, text="Startup Logs")
        
        self.startup_log = scrolledtext.ScrolledText(self.startup_frame, bg="#11111b", fg="#bac2de", font=("Consolas", 9), insertbackground="white")
        self.startup_log.pack(fill=tk.BOTH, expand=True)
        self.startup_log.config(state=tk.DISABLED)
        
        # Search Logs Tab
        self.search_frame = ttk.Frame(self.notebook)
        self.notebook.add(self.search_frame, text="Search Logs")
        
        self.search_log = scrolledtext.ScrolledText(self.search_frame, bg="#11111b", fg="#a6e3a1", font=("Consolas", 9), insertbackground="white")
        self.search_log.pack(fill=tk.BOTH, expand=True)
        self.search_log.config(state=tk.DISABLED)

    def load_env(self):
        """Simple .env loader to avoid dependencies"""
        if os.path.exists(".env"):
            with open(".env", "r") as f:
                for line in f:
                    if "=" in line and not line.startswith("#"):
                        key, value = line.strip().split("=", 1)
                        os.environ[key] = value
            self.log("Loaded configuration from .env")
        else:
            self.log("Warning: .env file not found", "warn")

    def log(self, message, level="info", tab="startup"):
        target_log = self.startup_log if tab == "startup" else self.search_log
        
        target_log.config(state=tk.NORMAL)
        color = self.fg_color
        if level == "error": color = self.error_color
        elif level == "warn": color = self.warn_color
        elif level == "success": color = self.success_color
        
        target_log.insert(tk.END, f"[{level.upper()}] {message}\n")
        target_log.see(tk.END)
        target_log.config(state=tk.DISABLED)

    def start_bot_process(self, commands_info):
        """
        commands_info: list of dictionaries with 'command', 'env', 'cwd'
        """
        if self.processes:
            messagebox.showwarning("Warning", "Bot processes are already running.")
            return
            
        self.load_env()

        self.btn_discord.config(state=tk.DISABLED)
        self.btn_twitch.config(state=tk.DISABLED)
        self.btn_both.config(state=tk.DISABLED)
        self.btn_gatecheck.config(state=tk.DISABLED)
        self.btn_stop.config(state=tk.NORMAL)
        self.status_label.config(text="Status: Running", foreground=self.warn_color)
        
        def run_all():
            threads = []
            for info in commands_info:
                t = threading.Thread(target=self._run_single_process, args=(info,), daemon=True)
                t.start()
                threads.append(t)
            
            for t in threads:
                t.join()
                
            self.root.after(0, self.on_process_ended)

        self.stop_event.clear()
        threading.Thread(target=run_all, daemon=True).start()

    def _run_single_process(self, info):
        command = info.get('command')
        env_vars = info.get('env', {})
        cwd = info.get('cwd')
        
        # Merge current env with requested ones
        current_env = os.environ.copy()
        current_env.update(env_vars)
        
        try:
            process = subprocess.Popen(
                command, 
                stdout=subprocess.PIPE, 
                stderr=subprocess.STDOUT, 
                env=current_env,
                cwd=cwd,
                text=True,
                bufsize=1,
                shell=os.name == 'nt',
                encoding="utf-8",
                errors="replace",
                creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
            )
            self.processes.append(process)
            
            for line in process.stdout:
                line = line.strip()
                name = info.get('name', 'Bot')
                
                if "[SEARCH]" in line:
                    self.root.after(0, lambda m=f"[{name}] {line}": self.log(m, "info", tab="search"))
                    # Optional: Automatically switch to search tab on new search
                    # self.root.after(0, lambda: self.notebook.select(self.search_frame))
                else:
                    self.root.after(0, lambda m=f"[{name}] {line}": self.log(m, "info", tab="startup"))
            
            process.wait()
        except Exception as e:
            self.log(f"Error starting {info.get('name', 'process')}: {e}", "error")

    def on_process_ended(self):
        # Only reset UI if ALL processes are gone
        if not any(p.poll() is None for p in self.processes):
            self.processes = []
            self.btn_discord.config(state=tk.NORMAL)
            self.btn_twitch.config(state=tk.NORMAL)
            self.btn_both.config(state=tk.NORMAL)
            self.btn_gatecheck.config(state=tk.NORMAL)
            self.btn_stop.config(state=tk.DISABLED)
            self.status_label.config(text="Status: Stopped", foreground=self.error_color)
            self.log("All processes exited.", "info")


    def start_discord_only(self):
        self.log("Starting All Discord Features...", "success")
        self.start_bot_process([
            {"name": "Main Bot", "command": ["npm", "start"], "env": {"DISCORD_ONLY_MODE": "true", "TWITCH_ONLY_MODE": "false"}},
            {"name": "Gatecheck", "command": [sys.executable, "main.py"], "cwd": "python_gatecheck_bot"}
        ])

    def start_twitch_only(self):
        self.log("Starting Twitch Bot (Twitch Only Mode)...", "success")
        self.start_bot_process([
            {"name": "Twitch Bot", "command": ["npm", "start"], "env": {"DISCORD_ONLY_MODE": "false", "TWITCH_ONLY_MODE": "true"}}
        ])

    def start_both(self):
        self.log("Starting Both Bots...", "success")
        self.start_bot_process([
            {"name": "Main Bot", "command": ["npm", "start"], "env": {"DISCORD_ONLY_MODE": "false", "TWITCH_ONLY_MODE": "false"}},
            {"name": "Gatecheck", "command": [sys.executable, "main.py"], "cwd": "python_gatecheck_bot"}
        ])

    def start_python_gatecheck(self):
        self.log("Starting Standalone Python Gatecheck...", "success")
        self.start_bot_process([
            {"name": "Gatecheck", "command": [sys.executable, "main.py"], "cwd": "python_gatecheck_bot"}
        ])

    def stop_bot(self):
        if self.processes:
            self.log("Stopping all processes...", "warn")
            for process in self.processes:
                if process.poll() is None:
                    if os.name == 'nt':
                        subprocess.run(['taskkill', '/F', '/T', '/PID', str(process.pid)], capture_output=True)
                    else:
                        os.killpg(os.getpgid(process.pid), signal.SIGTERM)
            self.processes = []
        else:
            self.log("No processes running.", "info")

if __name__ == "__main__":
    root = tk.Tk()
    app = BotGUI(root)
    
    def on_closing():
        if app.processes:
            app.stop_bot()
        root.destroy()
        
    root.protocol("WM_DELETE_WINDOW", on_closing)
    root.mainloop()
