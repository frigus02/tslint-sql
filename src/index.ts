import { analyze } from "./analysis";
import {
  createPayment,
  deletePayment,
  getPayment,
  getPaymentView,
  getUserByMetadata,
  updatePaymentDescription
} from "./test-data/queries";

const queries = [
  createPayment("123", "123", 123, "test"),
  updatePaymentDescription("123", "test 2"),
  getPaymentView("123", "123"),
  deletePayment("123", "123"),
  getPayment("token"),
  getUserByMetadata("token", "123")
];

for (const query of queries) {
  console.log(query.text);

  try {
    const result = analyze(query.text);
    console.log(result);
  } catch (e) {
    console.error(e);
  }
}
