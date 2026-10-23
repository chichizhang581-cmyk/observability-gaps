#include <chrono>
#include <exception>
#include <stdexcept>
#include <string>
#include <system_error>

void publish_order(const std::string& order_id, int attempt) {
    const auto started = std::chrono::steady_clock::now();
    try {
        const auto response = cpr::Post(cpr::Url{"/orders"}, cpr::Timeout{5000});
        spdlog::info("order_id={} status_code={} attempt={} duration={}",
                     order_id, response.status_code, attempt,
                     std::chrono::steady_clock::now() - started);
        producer.publish(order_id);
        transaction.commit();
    } catch (const std::exception& error) {
        LOG(ERROR) << "order_id=" << order_id << " attempt=" << attempt
                   << " cause=" << error.what();
        std::throw_with_nested(std::runtime_error("order publish failed"));
    }
}
