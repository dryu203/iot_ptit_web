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
#define TEMP_LED 27  // Đèn cảnh báo nhiệt độ
#define HUMID_LED 26 // Đèn cảnh báo độ ẩm
#define LIGHT_LED 32 // Đèn cảnh báo ánh sáng 

// Các hằng số thời gian
const unsigned long LOOP_INTERVAL = 10;      // 10ms cho vòng lặp chính
const unsigned long SENSOR_INTERVAL = 1000;  // 1 giây cho cập nhật cảm biến
const unsigned long BLINK_INTERVAL = 200;    // 200ms cho nháy đèn cảnh báo

// Ngưỡng cảnh báo
const float TEMP_THRESHOLD = 32.0;    
const float HUMID_THRESHOLD = 50.0;   
const float LIGHT_THRESHOLD = 200.0; 

unsigned long lastLoopTime = 0;
unsigned long lastSensorSend = 0;
unsigned long lastTempBlink = 0;
unsigned long lastHumidBlink = 0;
unsigned long lastLightBlink = 0;
bool tempAlertState = false;
bool humidAlertState = false;
bool lightAlertState = false;

// Thông tin WiFi
const char* ssid = "aiphone5";
const char* password = "66668888";

// MQTT broker
const char* mqttServer = "172.20.10.2"; 
const int mqttPort = 2003;                  
const char* mqttUsername = "dryu";  
const char* mqttPassword = "251103";  
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
      mqttClient.subscribe(mqttTopicControl);  
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
  if (now - lastSensorSend > SENSOR_INTERVAL) {
        lastSensorSend = now;

        float temperature = dht.readTemperature();
        float humidity = dht.readHumidity();
        int analogValue = analogRead(LDR_A0_PIN);
        float voltage = analogValue * (3.3 / 4095.0);
        float R_LDR = 10000.0 * (3.3 - voltage) / voltage; // 10k là điện trở phân áp
        float lux = 500.0 * pow(10, -log10(R_LDR/10000.0)); // Công thức chuyển đổi từ điện trở sang lux

        // Gửi dữ liệu cảm biến lên MQTT
        DynamicJsonDocument doc(256);
        doc["temperature"] = temperature;
        doc["humidity"] = humidity;
        doc["light"] = lux;
        char buffer[256];
        serializeJson(doc, buffer);
        mqttClient.publish(mqttTopicSensors, buffer);
    }
}

void handleAlerts() {
    unsigned long now = millis();
    float temperature = dht.readTemperature();
    float humidity = dht.readHumidity();
    int analogValue = analogRead(LDR_A0_PIN);
    float voltage = analogValue * (3.3 / 4095.0);
    float R_LDR = 10000.0 * (3.3 - voltage) / voltage; // 10k là điện trở phân áp
    float lux = 500.0 * pow(10, -log10(R_LDR/10000.0)); // Công thức chuyển đổi từ điện trở sang lux

    // Xử lý cảnh báo nhiệt độ
    if (temperature > TEMP_THRESHOLD) {
        if (now - lastTempBlink > BLINK_INTERVAL) {
            lastTempBlink = now;
            tempAlertState = !tempAlertState;
            digitalWrite(TEMP_LED, tempAlertState ? HIGH : LOW);
            
            // Gửi cảnh báo nhiệt độ
            DynamicJsonDocument alertDoc(128);
            alertDoc["temp_warning"] = true;
            alertDoc["temperature"] = temperature;
            char alertBuffer[128];
            serializeJson(alertDoc, alertBuffer);
            mqttClient.publish(mqttTopicSensors, alertBuffer);
        }
    } else {
        digitalWrite(TEMP_LED, LOW);
        tempAlertState = false;
    }

    // Xử lý cảnh báo độ ẩm
    if (humidity > HUMID_THRESHOLD) {
        if (now - lastHumidBlink > BLINK_INTERVAL) {
            lastHumidBlink = now;
            humidAlertState = !humidAlertState;
            digitalWrite(HUMID_LED, humidAlertState ? HIGH : LOW);
            
            // Gửi cảnh báo độ ẩm
            DynamicJsonDocument alertDoc(128);
            alertDoc["humid_warning"] = true;
            alertDoc["humidity"] = humidity;
            char alertBuffer[128];
            serializeJson(alertDoc, alertBuffer);
            mqttClient.publish(mqttTopicSensors, alertBuffer);
        }
    } else {
        digitalWrite(HUMID_LED, LOW);
        humidAlertState = false;
    }

    // Xử lý cảnh báo ánh sáng
    if (lux < LIGHT_THRESHOLD) {
        if (now - lastLightBlink > BLINK_INTERVAL) {
            lastLightBlink = now;
            lightAlertState = !lightAlertState;
            digitalWrite(LIGHT_LED, lightAlertState ? HIGH : LOW);
            
            // Gửi cảnh báo ánh sáng
            DynamicJsonDocument alertDoc(128);
            alertDoc["light_warning"] = true;
            alertDoc["light"] = lux;
            char alertBuffer[128];
            serializeJson(alertDoc, alertBuffer);
            mqttClient.publish(mqttTopicSensors, alertBuffer);
        }
    } else {
        digitalWrite(LIGHT_LED, LOW);
        lightAlertState = false;
    }
}

void setup() {
  Serial.begin(115200);
  setup_wifi();
  setup_mqtt();
  dht.begin();

  // Cấu hình chân LED là OUTPUT
  pinMode(LED1, OUTPUT);
  pinMode(LED2, OUTPUT);
  pinMode(LED3, OUTPUT);
  pinMode(TEMP_LED, OUTPUT);
  pinMode(HUMID_LED, OUTPUT);
  pinMode(LIGHT_LED, OUTPUT);

  pinMode(LDR_D0_PIN, INPUT);

  // Khởi tạo trạng thái LED
  digitalWrite(TEMP_LED, LOW);
  digitalWrite(HUMID_LED, LOW);
  digitalWrite(LIGHT_LED, LOW);
  digitalWrite(LED1, LOW);
  digitalWrite(LED2, LOW);
  digitalWrite(LED3, LOW);
}

void loop() {
  unsigned long currentTime = millis();

  // Kiểm tra kết nối MQTT
  if (!mqttClient.connected()) {
    setup_mqtt();
  }

  // Xử lý MQTT
  mqttClient.loop();

  // Gửi dữ liệu cảm biến và xử lý cảnh báo
  sendSensorData();
  handleAlerts();

  // Điều chỉnh thời gian giữa các vòng lặp
  unsigned long elapsedTime = currentTime - lastLoopTime;
  if (elapsedTime < LOOP_INTERVAL) {
    delay(LOOP_INTERVAL - elapsedTime);
  }
  lastLoopTime = currentTime;
}
