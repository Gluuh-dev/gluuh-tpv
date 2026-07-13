//go:build windows

package cmd

import "syscall"

// Windows no tiene SO_REUSEPORT. El nodo local de Gluuh es UN solo proceso
// escuchando en un puerto, así que no hace falta: se deja el socket por defecto.
func setReusePort(network, address string, c syscall.RawConn) error {
	return nil
}
