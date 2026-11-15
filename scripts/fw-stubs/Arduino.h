// 펌웨어 문법 검사용 가짜 Arduino-ESP32 헤더 (호스트 g++ -fsyntax-only 전용, 실제 동작 없음)
// 실제 컴파일은 GitHub Actions 의 arduino-cli + esp32 코어에서 한다 (.github/workflows/firmware.yml)
#pragma once
#include <stdint.h>
#include <stddef.h>
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <math.h>
#include <algorithm>
#include <string>
using std::max; using std::min;
#define HIGH 1
#define LOW 0
#define INPUT 1
#define OUTPUT 3
#define INPUT_PULLUP 5
#define CHANGE 3
#define IRAM_ATTR
#define ADC_11db 3
#define constrain(amt, low, high) ((amt) < (low) ? (low) : ((amt) > (high) ? (high) : (amt)))
typedef uint8_t byte;
class String {
 public:
  std::string s;
  String() {}
  String(const char* c) : s(c ? c : "") {}
  String(const std::string& x) : s(x) {}
  const char* c_str() const { return s.c_str(); }
  size_t length() const { return s.size(); }
  void trim() {}
  bool startsWith(const char* p) const { return s.rfind(p, 0) == 0; }
  bool operator==(const char* o) const { return s == o; }
};
struct HardwareSerial {
  void begin(unsigned long) {}
  int available() { return 0; }
  String readStringUntil(char) { return String(); }
  size_t println(const char*) { return 0; }
  size_t println() { return 0; }
  size_t print(const char*) { return 0; }
  int printf(const char*, ...) __attribute__((format(printf, 2, 3))) { return 0; }
};
extern HardwareSerial Serial;
void pinMode(uint8_t, uint8_t);
void digitalWrite(uint8_t, uint8_t);
int digitalRead(uint8_t);
uint32_t analogReadMilliVolts(uint8_t);
void analogSetPinAttenuation(uint8_t, int);
bool ledcAttach(uint8_t pin, uint32_t freq, uint8_t resolution);
bool ledcWrite(uint8_t pin, uint32_t duty);
uint32_t ledcWriteTone(uint8_t pin, uint32_t freq);
unsigned long millis();
unsigned long micros();
void delay(uint32_t);
void delayMicroseconds(uint32_t);
void attachInterrupt(uint8_t pin, void (*)(void), int mode);
inline uint8_t digitalPinToInterrupt(uint8_t p) { return p; }
void noInterrupts();
void interrupts();
