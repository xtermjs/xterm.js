from termios import tcgetattr, tcsetattr, TCSADRAIN, TIOCGWINSZ, TCSAFLUSH
from tty import setcbreak, setraw
import os
import sys
from contextlib import contextmanager
from select import select
from time import sleep
from json import dumps, loads
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
        tcsetattr(self.fd, TCSAFLUSH, self._initial_attr)
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
            setcbreak(self.fd, TCSAFLUSH)
            self.is_cbreak = True
            yield
        finally:
            tcsetattr(self.fd, TCSAFLUSH, tattr)
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
            setraw(self.fd, TCSAFLUSH)
            self.is_raw = True
            yield
        finally:
            tcsetattr(self.fd, TCSAFLUSH, tattr)
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

    def write(self, data: Union[str, bytes]) -> None:
        """
        Write string or bytes directly to the terminal.
        """
        if isinstance(data, str):
            data = data.encode('utf-8')
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
        if can_read:
            return os.read(self.fd, amount)
        return b''


@contextmanager
def cterminal_context():
    t = TerminalContext.from_cterm()
    try:
        yield t
    finally:
        t.close()


def extract_events(data: list[str]):
    if len(data) < 5:
        raise Exception('not enough reports')
    types = set(data)
    if len(types) == 1:
        return {'PRESS': data[0], 'REPEAT': data[0], 'RELEASE': None}
    if len(types) == 2:
        last = data.pop()
        if last != data[0] and len(set(data)) == 1:
            return {'PRESS': data[0], 'REPEAT': data[0], 'RELEASE': last}
        raise Exception('weird reports, 2 types')
    if len(types) == 3:
        first = data.pop(0)
        last = data.pop()
        if first != last and first != data[0] and last != data[0]:
            return {'PRESS': first, 'REPEAT': data[0], 'RELEASE': last}
        raise Exception('weird reports, 3 types')
    raise Exception('more than 3 types')


def query(term: TerminalContext, mode: int):
    with term.custom_state(undo=lambda:term.write('\x1b[<u')):
        term.write(f'\x1b[>{mode}u')
        sleep(.1)
        print('PRESS (within 5s) and HOLD (for 5s)\r')
        data: list[bytes] = []
        cur = term.read(timeout=5)
        while cur:
            data.append(cur)
            cur = term.read(timeout=.5)
            if len(data) > 5:
                print('RELEASE\r', end='')
        try:
            return extract_events([b.decode('utf-8') for b in data])
        except Exception as e:
            print('Error:', e, '\r')
            print(data, '\r')
    term.read(timeout=.1)


def save(filedata: dict[str, dict[str, str]], filename, entry, mode, events):
    try:
        filedata[entry][mode] = events
    except KeyError:
        filedata[entry] = {mode: events}
    with open(filename, 'w') as f:
        f.write(dumps(filedata, indent=2))


def main():
    mode = 1
    filedata = {}
    print(sys.argv)
    if len(sys.argv) != 3:
        print('ERROR: not enough arguments')
        print('Usage: python kitty_keytester.py <mode> <json-file>')
        return
    mode = int(sys.argv[1])
    filename = sys.argv[2]
    if os.path.exists(filename):
        with open(filename) as f:
            filedata = loads(f.read())
    with cterminal_context() as term:
        while True:
            with term.raw_mode():
                events = query(term, mode)
            if events:
                print(events)
                entry = input('Entry: ')
                if entry:
                    save(filedata, filename, entry, str(mode), events)
            cont = input('Continue? (y)')
            if cont not in ['y', '']:
                break


if __name__ == '__main__':
    main()
