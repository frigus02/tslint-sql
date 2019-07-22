CREATE TABLE users (
    user_id integer NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    age integer,
    created_at timestamp NOT NULL,
    updated_at timestamp NOT NULL
);

CREATE TYPE product_category AS ENUM (
    'Sweets',
    'Vegetables',
    'Fruit'
);

CREATE TABLE products (
    product_id integer NOT NULL,
    name text NOT NULL,
    category product_category NOT NULL,
    created_at timestamp NOT NULL,
    updated_at timestamp NOT NULL
);
