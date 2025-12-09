Short version: most likely your “broadcast Enter” is **not going through the same path as a real key press** (e.g. you’re only writing to xterm, not to the PTY), or you’re hitting a **line-discipline/newline mismatch** between OS + PTY + shell. Here’s a checklist of concrete causes + fixes.

---

## 1. You’re sending `\r`/`\r\n` to xterm, not to the PTY

In xterm.js the important distinction is:

* `term.onData(cb)` – **user input → backend** (PTY, node-pty, portable-pty, etc.) ([medium.com][1])
* `term.write(data)` / `writeln()` – **backend output → terminal screen** only. It **does not** feed data back into the shell.

In an xterm.js GitHub issue about executing commands by JS, someone tried `term.send`, `term.write` and `term.writeln` and noticed the command never executed unless they manually pressed enter from the keyboard. Maintainers’ advice was: *write to your PTY backend, not to xterm.js* – because xterm is just the UI. ([GitHub][2])

**If your broadcast implementation looks like:**

```ts
// ❌ wrong: only changes what’s drawn, not what the shell sees
for (const pane of panesToBroadcast) {
  pane.term.write(cmd + '\r\n');
}
```

…the shells in those panes will never receive that data, so “Enter” appears not to work.

### Fix

Broadcast to the **PTYs**, not to the terminals:

* For each target pane, call your Tauri command that writes to portable-pty:

```ts
// ✅ send to backend
invoke("write_to_session", {
  id: pane.sessionId,
  data: cmd + "\r"
});
```

You can still call `term.write` *afterwards* just to visually echo the command, but the crucial part is writing to the PTY.

A good pattern is:

* Treat xterm.js as **display + keyboard** only.
* Treat portable-pty as **source of truth** for all input/output.

---

## 2. Newline vs Enter vs line discipline: wrong LF/CR on the PTY side

On a real TTY:

* The “Enter” key typically sends **Carriage Return** (`\r`, 0x0D). ([Unix & Linux Stack Exchange][3])
* The kernel’s **line discipline** (ICANON + ICRNL/INLCR/ONLCR flags) may:

  * Convert CR to LF on input (`ICRNL`), and/or
  * Convert LF to CRLF on output (`ONLCR`). ([Super User][4])
* In canonical mode, the application doesn’t see anything until a line terminator is received (usually a **line feed `\n`** / 0x0A). ([lambdalambda.ninja][5])

So there are a couple of subtleties:

* **On Unix**:

  * Pressing Enter in a normal shell → CR from terminal → kernel translates to LF → shell gets a newline and executes. ([The Valuable Dev][6])
  * If you are writing directly to the PTY and bypassing some of that translation, sending only `\r` might not be enough, depending on flags.
* **On Windows**:

  * Many APIs expect **CRLF (`\r\n`)** as line ending; and there can be additional translations in ConPTY/winpty. ([Stack Overflow][7])
  * portable-pty’s own example shows sending `ls -l\r\n\x04` (CRLF + EOT) into the PTY. ([GitHub][8])

### Fixes / experiments

1. **Try sending just `\n`** from the Rust side for Unix:

   ```rust
   write_all(b"your command here\n")?;
   ```

   and see if the shell now executes.

2. For cross-platform:

   ```rust
   #[cfg(windows)]
   const EOL: &str = "\r\n";
   #[cfg(not(windows))]
   const EOL: &str = "\n";

   write_all(format!("{cmd}{EOL}").as_bytes())?;
   ```

3. Check that you’re writing to the **PTY master**, not to the child’s stdin pipe directly; you want the kernel TTY machinery to do its CR/LF conversion.

4. If you changed termios flags (raw mode etc.), make sure the shell is still in canonical mode when you expect “press enter to run line” behavior.

---

## 3. Broadcasting from xterm’s `onData` vs manual “fake” newline

The most robust way to make “broadcast input” behave exactly like a real user is:

* Pick one pane as the **leader**.
* Hook `leaderTerm.onData(data => …)` and for each data chunk (including `"\r"` for Enter) send it to:

  * the leader’s PTY, and
  * **all other target PTYs**.

When the user presses Enter, xterm.js will emit `"\r"` (or the correct sequence) in `onData`. You don’t have to guess CR vs LF at all.

Rough sketch:

```ts
leaderTerm.onData((data) => {
  const targetSessions = getBroadcastSessionIds(); // includes leader if you want

  for (const id of targetSessions) {
    invoke("write_to_session", { id, data }); // raw data, including "\r"
  }
});
```

Because you’re relaying the exact same bytes to all sessions, all the PTYs see exactly what the leader PTY sees, and the shell behavior matches “real typing”.

---

## 4. The broadcast path might only be echoing, not submitting

A common mistake is to:

1. Build the command string in JS (e.g. from an input box).
2. Write it to each xterm for visual feedback, **but not to the PTY**.
3. Then try to “just send `\r`” separately — but that `\r` also only goes to xterm, not to the shell.

Result:

* You see a nicely echoed command and even a wrapped cursor, but nothing actually runs. (Very similar to the xterm.js “local echo” article where they show how just echoing `term.write(data)` doesn’t interact with a real shell at all. ([medium.com][1]))

**Fix pattern:**

* For each pane:

  * send `cmd + EOL` to PTY (backend),
  * *optionally* also `term.write(cmd + EOL)` to keep UI in sync.

---

## 5. Target program isn’t a shell in canonical mode

If the thing running in the pane is **not** a normal shell prompt:

* e.g. `vim`, `less`, `fzf`, `python` REPL in non-canonical mode, some curses/TUI app, etc. ([Made of Bugs][9])

Then:

* “Enter” doesn’t necessarily mean “submit line”; it may be a program-specific key binding.
* Sending `\r` or `\n` may just move a cursor or be ignored, depending on the app.

You’ll see:

* “Enter” from your physical keyboard behaves one way (because the app interprets it), but
* your broadcast path might not be capturing and relaying **the same sequence** (for example, mouse escape sequences, function keys, etc.).

**Fix**

Again, the safest route is to **mirror `onData`** of the leader pane for all keys, not to special-case “line commands” at the broadcast layer.

---

## 6. Practical debugging tips

To really see what’s going on, do these in one of your panes:

1. Run `cat -v` (or `hexdump`):

   ```bash
   # In a target pane
   cat -v
   ```

   Now:

   * Type normally: you should see characters and `^M` for `\r` when you hit Enter, or `$` at end-of-line.
   * Use your broadcast feature to send `abc` + “Enter”.

   If the broadcasted version:

   * **Doesn’t show up at all** → data never reaches PTY → you’re probably only calling `term.write`.
   * Shows `abc^M` but `cat` never exits the line → PTY flags / newline semantics mismatch.
   * Shows different hex bytes compared to normal typing → your JSON / encoding / escaping path is mangling the newline.

2. Log the hex of what you write from Rust:

   ```rust
   for b in data.as_bytes() {
       println!("write_to_session: {:02x}", b);
   }
   ```

   Compare for:

   * “normal Enter” path (captured from leader’s `onData`) vs
   * “broadcast newline” path.

They should be identical in the happy path.

---

## Summary

The most likely root causes for “CR / CRLF doesn’t execute command when broadcasting” in your Tauri + xterm.js + portable-pty setup are:

1. **Broadcast writes to xterm, not the PTY** → shell never sees the newline. ([GitHub][2])
2. **Newline/line-discipline mismatch** – you’re sending the wrong EOL for the PTY/OS mode; try `\n` on Unix and `\r\n` on Windows as the final terminator, or just mirror whatever the leader’s `onData` gives. ([Super User][4])
3. **Program not in canonical “press enter to submit” mode** – broadcasting raw `\r` doesn’t have the semantic meaning you expect.

If you want, you can paste your broadcast Rust/TS snippets next and I can annotate where I’d change them to make Enter behave identically to real typing.

[1]: https://medium.com/swlh/local-echo-xterm-js-5210f062377e?utm_source=chatgpt.com "Local echo & xterm.js - by Ioannis Charalampidis"
[2]: https://github.com/xtermjs/xterm.js/issues/1107?utm_source=chatgpt.com "Executing a command by javascript when clicking on a link"
[3]: https://unix.stackexchange.com/questions/349214/enter-key-is-different-from-carriage-return-cr?utm_source=chatgpt.com "Enter key is different from Carriage Return (CR)"
[4]: https://superuser.com/questions/714078/wrong-newline-character-over-serial-port-cr-instead-of-lf?utm_source=chatgpt.com "Wrong newline character over serial port (CR instead of LF)"
[5]: https://lambdalambda.ninja/blog/56/?utm_source=chatgpt.com "Understanding the tty subsystem: Line discipline - Jonathan Lam"
[6]: https://thevaluable.dev/guide-terminal-shell-console/?utm_source=chatgpt.com "A Guide to the Terminal, Console, and Shell"
[7]: https://stackoverflow.com/questions/1552749/difference-between-cr-lf-lf-and-cr-line-break-types?utm_source=chatgpt.com "Difference between CR LF, LF and CR line break types"
[8]: https://github.com/wez/wezterm/discussions/2392?utm_source=chatgpt.com "Spawning a shell into portable_pty #2392"
[9]: https://blog.nelhage.com/2009/12/a-brief-introduction-to-termios-termios3-and-stty/?utm_source=chatgpt.com "A Brief Introduction to termios: termios(3) and stty - Made of Bugs"
