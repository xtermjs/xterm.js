#include <stdio.h>
#include <unistd.h>
#include <string.h>

static char MSG[10][10] = {
  { [0 ... 8] = '0', '\n' },
  { [0 ... 8] = '1', '\n' },
  { [0 ... 8] = '2', '\n' },
  { [0 ... 8] = '3', '\n' },
  { [0 ... 8] = '4', '\n' },
  { [0 ... 8] = '5', '\n' },
  { [0 ... 8] = '6', '\n' },
  { [0 ... 8] = '7', '\n' },
  { [0 ... 8] = '8', '\n' },
  { [0 ... 8] = '9', '\n' },
};
static char ALL[60000];

int main(int argc, char **argv) {
  int i, offset = 0;
  // fill 10kB buffer
  for (i=0; i<600; ++i) {
    memcpy(ALL+i*100, MSG, 100);
  }
  // copy buffer data as fast as possible (~6GB/s on my machine)
  while (1) {
    write(1, ALL, 60000);
  }
}
