export interface Query {
  name?: string;
  text: string;
  values: any[];
}

export const sql = (name: string) => (
  strings: TemplateStringsArray,
  ...values: any[]
): Query => ({
  name,
  text: String.raw(strings, ...values.map((_, i) => `$${i + 1}`)),
  values
});

export const createPayment = (
  paymentId: string,
  userId: string,
  amount: number,
  description: string
) => sql("create-payment")`
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

export const updatePaymentDescription = (
  paymentId: string,
  description: string
) => sql("update-payment-description")`
  UPDATE
    payments
  SET
    description = ${description},
    updated_at = ${new Date().toISOString()}
  WHERE
    payment_id = ${paymentId}
`;

export const getPayment = (paymentId: string) => sql("get-payment")`
  SELECT * FROM payments WHERE payment_id = ${paymentId}
`;

export const getPaymentView = (paymentId: string, userId: string) => sql(
  "get-payment-view"
)`
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

export const getUserByMetadata = (userId: string, metadata: string) => sql(
  "get-user-by-metadata"
)`
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

export const deletePayment = (userId: string, paymentId: string) => sql(
  "delete-payment"
)`
  DELETE FROM payments WHERE user_id = ${userId} AND payment_id = ${paymentId}
`;
