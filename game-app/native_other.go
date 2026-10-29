//go:build !windows

package main

// No built-in window on this system; the game opens in the default browser.
func runNative(string) bool { return false }
