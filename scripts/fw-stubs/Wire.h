#pragma once
#include "Arduino.h"
class TwoWire {
 public:
  bool begin(int sda, int scl, uint32_t frequency = 0);
  void beginTransmission(uint16_t address);
  uint8_t endTransmission(bool sendStop = true);
  size_t requestFrom(uint16_t address, size_t size, bool sendStop = true);
  size_t write(uint8_t);
  int read();
};
extern TwoWire Wire;
