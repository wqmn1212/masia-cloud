#pragma once
#include <stdint.h>
typedef int esp_err_t;
#define ESP_OK 0
#define CONFIG_IDF_TARGET_ESP32S3 1
typedef enum { BLE_DTM_PKT_PAYLOAD_0x00 = 0 } esp_ble_dtm_pkt_payload_t;
typedef struct { uint8_t tx_channel; uint8_t len_of_data; esp_ble_dtm_pkt_payload_t pkt_payload; } esp_ble_dtm_tx_t;
esp_err_t esp_ble_dtm_tx_start(const esp_ble_dtm_tx_t*);
esp_err_t esp_ble_dtm_stop(void);
