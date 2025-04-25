#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>
#include <ArduinoJson.h>

// Cảm biến DHT11
#define DHTPIN 4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// Cảm biến ánh sáng (LDR)
#define LDR_A0_PIN 34  // Chân Analog G34
#define LDR_D0_PIN 25  // Chân Digital G25

// Cấu hình LED
#define LED1 14  
#define LED2 12  
#define LED3 13 
#define LED_WIND  27  

unsigned long lastSensorSend = 0;
unsigned long lastWindBlink = 0;
bool windAlertState = false;
int lastWindValue = 0;

// Thông tin WiFi
const char* ssid = "LQHOMES501";
const char* password = "LQHOMES1368";

// MQTT broker
const char* mqttServer = "192.168.51.4"; // Thay bằng địa chỉ MQTT broker của bạn
const int mqttPort = 2003;                   // Thay bằng cổng MQTT của bạn
const char* mqttUsername = "dryu";  // Thay bằng username của bạn
const char* mqttPassword = "251103";  // Thay bằng password của bạn
const char* mqttTopicSensors = "iot/sensors";
const char* mqttTopicDevices = "iot/devices";
const char* mqttTopicControl = "iot/devices/control";

WiFiClient espClient;
PubSubClient mqttClient(espClient);

// Kết nối WiFi
void setup_wifi() {
  Serial.print("Dang ket noi toi WiFi: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi da ket noi!");
  Serial.print("Dia chi IP: ");
  Serial.println(WiFi.localIP());
}

void setup_mqtt() {
  mqttClient.setServer(mqttServer, mqttPort);
  mqttClient.setCallback(mqttCallback);

  while (!mqttClient.connected()) {
    Serial.println("Đang kết nối đến MQTT broker...");
    if (mqttClient.connect("ESP32Client", mqttUsername, mqttPassword)) {
      Serial.println("Kết nối MQTT thành công!");
      mqttClient.subscribe(mqttTopicControl); // Lắng nghe lệnh điều khiển
    } else {
      Serial.print("Lỗi kết nối MQTT: ");
      Serial.println(mqttClient.state());
      delay(2000);
    }
  }
}

void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message;
  for (int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  Serial.printf("Nhận lệnh từ MQTT [%s]: %s\n", topic, message.c_str());

  if (String(topic) == mqttTopicControl) {
    DynamicJsonDocument doc(256);
    deserializeJson(doc, message);
    String device_name = doc["device_name"];
    String status = doc["status"];

    bool changed = false;
    if (device_name == "Light 1") {
      digitalWrite(LED1, status == "ON" ? HIGH : LOW);
      changed = true;
    }
    if (device_name == "Light 2") {
      digitalWrite(LED2, status == "ON" ? HIGH : LOW);
      changed = true;
    }
    if (device_name == "Light 3") {
      digitalWrite(LED3, status == "ON" ? HIGH : LOW);
      changed = true;
    }

    // Sau khi thực hiện lệnh, gửi trạng thái thực tế về topic iot/devices cho web cập nhật giao diện
    if (changed) {
      DynamicJsonDocument respDoc(128);
      respDoc["device_name"] = device_name;
      respDoc["status"] = status;
      char respBuffer[128];
      serializeJson(respDoc, respBuffer);
      mqttClient.publish(mqttTopicDevices, respBuffer);
      Serial.printf("Đã gửi trạng thái thực tế lên MQTT: %s\n", respBuffer);
    }
  }
}

void sendSensorData() {
    unsigned long now = millis();
    if (now - lastSensorSend > 3000) { // Gửi mỗi 3 giây
        lastSensorSend = now;

        float temperature = dht.readTemperature();
        float humidity = dht.readHumidity();
        int analogValue = analogRead(LDR_A0_PIN);
        float voltage = analogValue * (3.3 / 4095.0);
        float lux = 500 / voltage;

        // Random wind (0-90)
        int wind = random(0, 91);
        lastWindValue = wind; // Lưu lại giá trị wind mới nhất

        // Gửi dữ liệu cảm biến lên MQTT
        DynamicJsonDocument doc(256);
        doc["temperature"] = temperature;
        doc["humidity"] = humidity;
        doc["light"] = lux;
        doc["wind"] = wind;
        char buffer[256];
        serializeJson(doc, buffer);
        mqttClient.publish(mqttTopicSensors, buffer);
    }
}

void handleWindWarning() {
    unsigned long now = millis();
    if (lastWindValue > 50) {
        if (now - lastWindBlink > 200) { // Nháy mỗi 200ms
            lastWindBlink = now;
            windAlertState = !windAlertState;
            digitalWrite(LED_WIND, windAlertState ? HIGH : LOW);
        }
    } else {
        digitalWrite(LED_WIND, LOW);
        windAlertState = false;
    }
}

// void sendSensorData() {

//   unsigned long now = millis();
//       if (now - lastSensorSend > 3000) {
//           lastSensorSend = now;

//           float temperature = dht.readTemperature();
//           float humidity = dht.readHumidity();
//           int analogValue = analogRead(LDR_A0_PIN);
//           float voltage = analogValue * (3.3 / 4095.0);
//           float lux = 500 / voltage;

//           // Random wind (0-90)
//           int wind = random(0, 91);

//           // Gửi dữ liệu cảm biến lên MQTT
//           DynamicJsonDocument doc(256);
//           doc["temperature"] = temperature;
//           doc["humidity"] = humidity;
//           doc["light"] = lux;
//           doc["wind"] = wind;
//           char buffer[256];
//           serializeJson(doc, buffer);
//           mqttClient.publish(mqttTopicSensors, buffer);

//           // Xử lý LED cảnh báo gió
//           if (wind > 50) {
//               windAlertState = !windAlertState;
//               digitalWrite(LED_WIND, windAlertState ? HIGH : LOW);
//           } else {
//               digitalWrite(LED_WIND, LOW);
//           }
//       }

//   // float temperature = dht.readTemperature();
//   // float humidity = dht.readHumidity();
//   // int analogValue = analogRead(LDR_A0_PIN);
//   // float voltage = analogValue * (3.3 / 4095.0);
//   // float lux = 500 / voltage;

//   // if (!isnan(temperature) && !isnan(humidity)) {
//   //   DynamicJsonDocument doc(256);
//   //   doc["temperature"] = temperature;
//   //   doc["humidity"] = humidity;
//   //   doc["light"] = lux;

//   //   char buffer[256];
//   //   serializeJson(doc, buffer);
//   //   mqttClient.publish(mqttTopicSensors, buffer);
//   //   Serial.println("Dữ liệu cảm biến đã được gửi qua MQTT.");
//   // } else {
//   //   Serial.println("Lỗi đọc cảm biến!");
//   // }
// }

void setup() {
  Serial.begin(115200);
  setup_wifi();
  setup_mqtt();
  dht.begin();

  // Cấu hình chân LED là OUTPUT
  pinMode(LED1, OUTPUT);
  pinMode(LED2, OUTPUT);
  pinMode(LED3, OUTPUT);
  pinMode(LED_WIND, OUTPUT);

  pinMode(LDR_D0_PIN, INPUT);

  digitalWrite(LED_WIND, LOW);
  digitalWrite(LED1, LOW);
  digitalWrite(LED2, LOW);
  digitalWrite(LED3, LOW);
}

void loop() {
  if (!mqttClient.connected()) {
    setup_mqtt();
  }
  mqttClient.loop();

  sendSensorData();
  handleWindWarning();
  delay(10); // Gửi dữ liệu mỗi 2 giây
}
