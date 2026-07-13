//go:build !windows

package cmd

import (
	"syscall"

	"golang.org/x/sys/unix"
)

// setReusePort activa SO_REUSEPORT (solo Unix): permite que varios procesos
// compartan el puerto para reiniciar sin cortar conexiones. Comportamiento
// ORIGINAL de supabase/auth, movido aquí sin cambios.
func setReusePort(network, address string, c syscall.RawConn) error {
	var serr error
	if err := c.Control(func(fd uintptr) {
		serr = unix.SetsockoptInt(int(fd), unix.SOL_SOCKET, unix.SO_REUSEPORT, 1) // #nosec G115
	}); err != nil {
		return err
	}
	return serr
}
