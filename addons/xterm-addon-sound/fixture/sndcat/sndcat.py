import wave
import base64
import sys


def create_sound_sequence(channels, width, rate, frames):
    b64data = base64.b64encode(frames).decode('ascii')
    return f'\x1bP{channels};{width};{rate};{len(frames)};{len(b64data)}a{b64data}\x1b\\'


def stream_wav(filename):
    with wave.open(filename) as wav:
        channels = wav.getnchannels()
        width = wav.getsampwidth()
        rate = wav.getframerate()
        frames = wav.getnframes()
        print({'channels': channels, 'width': width, 'rate': rate, 'frames': frames})
        pos = 0
        while pos < frames:
            print(create_sound_sequence(channels, width, rate, wav.readframes(rate)), end='')
            pos += rate
        print()


if __name__ == '__main__':
    stream_wav(sys.argv[1])
