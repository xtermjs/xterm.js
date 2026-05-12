from termios import tcgetattr, tcsetattr, TCSADRAIN, TIOCGWINSZ
from tty import setcbreak, setraw
import os
from contextlib import contextmanager
from select import select
from time import sleep
from typing import Optional, Tuple, Union


class TerminalContext:
    def __init__(self, fd: int, close_fd=False) -> None:
        if not os.isatty(fd):
            raise TypeError('fd is not a terminal')
        self.close_fd = close_fd
        self.fd = fd
        self.is_cbreak = False
        self.is_raw = False
        self._initial_attr = self.termios_attributes

    @classmethod
    def from_cterm(cls):
        fd = os.open(os.ctermid(), os.O_RDWR)
        return TerminalContext(fd, True)

    def close(self) -> None:
        tcsetattr(self.fd, TCSADRAIN, self._initial_attr)
        if self.close_fd:
            os.close(self.fd)

    @property
    def termios_attributes(self) -> list:
        return tcgetattr(self.fd)
    
    @property
    def ttyname(self) -> str:
        return os.ttyname(self.fd)
    
    @contextmanager
    def cbreak_mode(self):
        """
        Enter cbreak mode context.
        """
        if self.is_cbreak:
            yield
            return
        tattr = self.termios_attributes
        try:
            setcbreak(self.fd, TCSADRAIN)
            self.is_cbreak = True
            yield
        finally:
            tcsetattr(self.fd, TCSADRAIN, tattr)
            self.is_cbreak = False

    @contextmanager
    def raw_mode(self):
        """
        Enter cbreak mode context.
        """
        if self.is_raw:
            yield
            return
        tattr = self.termios_attributes
        try:
            setraw(self.fd, TCSADRAIN)
            self.is_raw = True
            yield
        finally:
            tcsetattr(self.fd, TCSADRAIN, tattr)
            self.is_raw = False

    @contextmanager
    def custom_state(self, undo=None):
        """
        Enter custom terminal state, that needs to to be undone by ``undo``.
        Useful, if you want to apply a custom terminal state and
        have to make sure, that it gets properly reset to previous state.
        """
        try:
            yield
        finally:
            if undo:
                undo()

    def write(self, s: Union[str, bytes]) -> None:
        """
        Write string or bytes directly to the terminal.
        """
        data = s if isinstance(s, bytes) else s.encode('utf-8')
        sent = os.write(self.fd, data)
        while sent:
            data = data[sent:]
            sent = os.write(self.fd, data)

    def read(self, amount: int = 1024, timeout: Optional[float] = None) -> bytes:
        """
        Blocking read from the terminal.
        If nothing was sent from the terminal within ``timeout``,
        empty bytes are returned.
        """
        can_read, _, _ = select([self.fd], [], [], timeout)
        return os.read(self.fd, amount) if can_read else b''


@contextmanager
def cterminal_context():
    t = TerminalContext.from_cterm()
    try:
        yield t
    finally:
        t.close()


with cterminal_context() as term:
    with term.custom_state(undo=lambda:term.write('\x1b[<u')), term.raw_mode():
        term.write('\x1b[>3u')
        sleep(1)
        print('PRESS (within 10s) and HOLD (for 5s)\r')
        data = []
        cur = term.read(timeout=10)
        while cur:
            data.append(cur)
            cur = term.read(timeout=1)
            if len(data) > 5:
                print('RELEASE\r')
        sleep(0.5)
        term.read(timeout=0.1)
        print(data, '\r')

    sleep(1)

