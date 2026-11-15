#pragma once
#include "Arduino.h"
class BLEUUID { public: BLEUUID(const char*) {} };
class BLEDescriptor { public: virtual ~BLEDescriptor() {} };
class BLECharacteristic;
class BLECharacteristicCallbacks { public: virtual ~BLECharacteristicCallbacks() {} virtual void onWrite(BLECharacteristic*) {} };
class BLECharacteristic {
 public:
  static const uint32_t PROPERTY_READ = 1, PROPERTY_WRITE = 2, PROPERTY_NOTIFY = 4, PROPERTY_INDICATE = 8, PROPERTY_WRITE_NR = 16;
  void setValue(uint8_t* data, size_t len);
  void setValue(const char* s);
  void setValue(String s);
  String getValue();
  void notify(bool is_notification = true);
  void addDescriptor(BLEDescriptor*);
  void setCallbacks(BLECharacteristicCallbacks*);
};
class BLEService { public: BLECharacteristic* createCharacteristic(const char*, uint32_t); BLECharacteristic* createCharacteristic(BLEUUID, uint32_t); void start(); };
class BLEServer;
class BLEServerCallbacks { public: virtual ~BLEServerCallbacks() {} virtual void onConnect(BLEServer*) {} virtual void onDisconnect(BLEServer*) {} };
class BLEServer { public: BLEService* createService(BLEUUID, uint32_t numHandles = 15, uint8_t inst_id = 0); void setCallbacks(BLEServerCallbacks*); };
class BLEAdvertising { public: void addServiceUUID(const char*); void setScanResponse(bool); };
class BLEDevice { public: static void init(String); static BLEServer* createServer(); static BLEAdvertising* getAdvertising(); static void startAdvertising(); };
