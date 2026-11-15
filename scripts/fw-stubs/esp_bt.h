#pragma once
typedef enum { ESP_PWR_LVL_N12, ESP_PWR_LVL_N6, ESP_PWR_LVL_N0, ESP_PWR_LVL_P3, ESP_PWR_LVL_P6, ESP_PWR_LVL_P9 } esp_power_level_t;
typedef enum { ESP_BLE_PWR_TYPE_DEFAULT = 11 } esp_ble_power_type_t;
int esp_ble_tx_power_set(esp_ble_power_type_t, esp_power_level_t);
