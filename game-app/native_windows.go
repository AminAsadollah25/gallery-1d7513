package main

import (
	"os"
	"path/filepath"
	"runtime"
	"syscall"
	"unsafe"

	webview2 "github.com/jchv/go-webview2"
)

func init() {
	// Windows GUI calls must all come from the same thread.
	runtime.LockOSThread()
}

func runNative(html string) bool {
	w := webview2.NewWithOptions(webview2.WebViewOptions{
		AutoFocus: true, // keep keyboard focus on the game
		DataPath:  filepath.Join(os.Getenv("APPDATA"), "NeonMetroidvania"),
		WindowOptions: webview2.WindowOptions{
			Title:  appTitle,
			Width:  1280,
			Height: 720,
			Center: true,
		},
	})
	if w == nil {
		// WebView2 is not installed: close the empty window and fall back to the browser.
		closeEmptyWindow()
		return false
	}
	defer w.Destroy()
	w.SetHtml(html)
	w.Run()
	return true
}

func closeEmptyWindow() {
	user32 := syscall.NewLazyDLL("user32.dll")
	cls, _ := syscall.UTF16PtrFromString("webview")
	hwnd, _, _ := user32.NewProc("FindWindowW").Call(uintptr(unsafe.Pointer(cls)), 0)
	if hwnd != 0 {
		user32.NewProc("DestroyWindow").Call(hwnd)
	}
}
