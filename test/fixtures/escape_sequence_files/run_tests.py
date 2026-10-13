from glob import glob
import os
import sys
import termios
import atexit

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def enable_echo(fd, enabled):
    (iflag, oflag, cflag, lflag, ispeed, ospeed, cc) = termios.tcgetattr(fd)
    if enabled:
        lflag |= termios.ECHO
    else:
        lflag &= ~termios.ECHO
    new_attr = [iflag, oflag, cflag, lflag, ispeed, ospeed, cc]
    termios.tcsetattr(fd, termios.TCSANOW, new_attr)

atexit.register(enable_echo, sys.stdin.fileno(), True)

output = []


def log(append=False, *s):
    if append:
        output[-1] += ' ' + ' '.join(str(part) for part in s)
    else:
        output.append(' '.join(str(part) for part in s))


def reset_terminal():
    sys.stdout.write('\x1bc\x1b[H')
    sys.stdout.flush()


def test():
    count = 0
    passed = 0
    for i, testfile in enumerate(sorted(glob(os.path.join(BASE_DIR, '*.in')))):
        count += 1
        log(False, os.path.basename(testfile))
        reset_terminal()
        with open(testfile) as test:
            sys.stdout.write('\x1b]0;%s\x07' % os.path.basename(testfile))
            sys.stdout.write(test.read()+'\x1bt')
            sys.stdout.flush()
        with open(os.path.join(os.path.dirname(testfile),
                               os.path.basename(testfile).split('.')[0]+'.text')) as expected:
            terminal_output = sys.stdin.read()
            if not terminal_output:
                # we are in xterm
                continue
            if terminal_output != expected.read():
                log(True, '\x1b[31merror\x1b[0m')
                with open(os.path.join(os.path.dirname(testfile), 'output',
                                       os.path.basename(testfile)), 'w') as t_out:
                    t_out.write(terminal_output)
            else:
                passed += 1
                log(True, '\x1b[32mpass\x1b[0m')
    return count, passed


if __name__ == '__main__':
    enable_echo(sys.stdin.fileno(), False)
    count, passed = test()
    enable_echo(sys.stdin.fileno(), True)
    reset_terminal()
    for i in range(len(output)/2+1):
        if not (i+1) % 25:
            sys.stdin.read()
        print ''.join(i.ljust(40) for i in output[i*2:i*2+2])
    print '\x1b[33mcoverage: %s/%s (%d%%) tests passed.\x1b[0m' % (passed, count, passed*100/count)
