// Neon Metroidvania launcher.
// Bundles game.html inside the executable and shows it:
//   - Windows: in its own window (WebView2, built into Windows 10/11).
//   - Other systems, or if WebView2 is missing: in the default web browser.
package main

import (
	_ "embed"
	"net"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"sync/atomic"
	"time"
)

//go:embed game.html
var gameHTML string

const appTitle = "Neon Metroidvania"

func main() {
	if runNative(gameHTML) {
		return
	}
	runInBrowser()
}

// runInBrowser serves the game on a local port and opens it in the default browser.
// The page pings the server; when the tab is closed the pings stop and the program exits.
func runInBrowser() {
	const pingScript = `<script>setInterval(function(){fetch('/ping').catch(function(){})},15000);</script>`
	page := strings.Replace(gameHTML, "</body>", pingScript+"</body>", 1)

	var lastPing atomic.Int64
	lastPing.Store(time.Now().Unix())

	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		lastPing.Store(time.Now().Unix())
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write([]byte(page))
	})
	mux.HandleFunc("/ping", func(w http.ResponseWriter, r *http.Request) {
		lastPing.Store(time.Now().Unix())
		w.WriteHeader(http.StatusNoContent)
	})

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		os.Exit(1)
	}
	go http.Serve(ln, mux)
	openBrowser("http://" + ln.Addr().String() + "/")

	// Background tabs may throttle timers to about once a minute, so allow a generous gap.
	for {
		time.Sleep(10 * time.Second)
		if time.Now().Unix()-lastPing.Load() > 180 {
			return
		}
	}
}

func openBrowser(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	cmd.Start()
}
