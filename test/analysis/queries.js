const sql = name => (strings, ...values) => ({
  name,
  text: String.raw(strings, ...values.map((_, i) => `$${i + 1}`)),
  values
});

const createPayment = (paymentId, userId, amount, description) => sql(
  "create-payment"
)`
  INSERT INTO payments(
    payment_id,
    user_id,
    amount,
    description,
    created_at,
    updated_at
  ) VALUES(
    ${paymentId},
    ${userId},
    ${amount},
    ${description},
    NOW(),
    NOW()
  )
  RETURNING *
`;

const updatePaymentDescription = (paymentId, description) => sql(
  "update-payment-description"
)`
  UPDATE
    payments
  SET
    description = ${description},
    updated_at = ${new Date().toISOString()}
  WHERE
    payment_id = ${paymentId}
`;

const getPayment = paymentId => sql("get-payment")`
  SELECT * FROM payments WHERE payment_id = ${paymentId}
`;

const getPaymentView = (paymentId, userId) => sql("get-payment-view")`
  SELECT
    p.payment_id,
    p.description,
    p.created_at AS payment_created_at,
    p.amount,
    u.user_id,
    u.name
  FROM
    payments p
    LEFT JOIN users u ON p.user_id = u.user_id
  WHERE
    p.payment_id = ${paymentId}
    AND p.user_id = ${userId}
    AND p.status NOT IN ('cancelled_by_user', ${"cancelled_by_us"})
`;

const getUserByMetadata = (userId, metadata) => sql("get-user-by-metadata")`
  SELECT
    user_id,
    name
  FROM
    beneficiaries
  WHERE
    user_id = ${userId}
  AND
    details ->> 'metadata' = ${metadata}
`;

const deletePayment = (userId, paymentId) => sql("delete-payment")`
  DELETE FROM payments WHERE user_id = ${userId} AND payment_id = ${paymentId}
`;

module.exports = {
  createPayment,
  updatePaymentDescription,
  getPayment,
  getPaymentView,
  getUserByMetadata,
  deletePayment
};
