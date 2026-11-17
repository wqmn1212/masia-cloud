#pragma once
#include "Arduino.h"
class Preferences {
 public:
  bool begin(const char*, bool readOnly = false);
  void end();
  bool clear();
  int16_t getShort(const char*, int16_t def = 0);
  uint16_t getUShort(const char*, uint16_t def = 0);
  size_t putShort(const char*, int16_t);
  size_t putUShort(const char*, uint16_t);
  size_t getBytesLength(const char*);
  size_t getBytes(const char*, void*, size_t);
  size_t putBytes(const char*, const void*, size_t);
};
