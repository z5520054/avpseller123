export const schemaSql = `
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  source_key TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  title_normalized TEXT NOT NULL,
  kind TEXT NOT NULL,
  product_url TEXT NOT NULL,
  cover_url TEXT,
  release_date TEXT,
  publisher TEXT,
  developer TEXT,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_platforms (
  product_id INTEGER NOT NULL,
  platform TEXT NOT NULL,
  PRIMARY KEY (product_id, platform),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_tags (
  product_id INTEGER NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (product_id, tag),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_source_ranks (
  product_id INTEGER NOT NULL,
  region TEXT NOT NULL,
  tag TEXT NOT NULL,
  rank INTEGER NOT NULL,
  PRIMARY KEY (product_id, region, tag),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS offers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  region TEXT NOT NULL,
  currency TEXT NOT NULL,
  base_price_minor INTEGER,
  discounted_price_minor INTEGER,
  discount_percent INTEGER,
  sale_start_at TEXT,
  sale_end_at TEXT,
  plus_tier TEXT,
  sale_name TEXT,
  availability TEXT NOT NULL,
  source_updated_at TEXT,
  last_seen_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_offer
  ON offers (product_id, region, currency, IFNULL(plus_tier, ''));

CREATE TABLE IF NOT EXISTS price_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL,
  offer_id INTEGER NOT NULL,
  checked_at TEXT NOT NULL,
  region TEXT NOT NULL,
  currency TEXT NOT NULL,
  base_price_minor INTEGER,
  discounted_price_minor INTEGER,
  discount_percent INTEGER,
  sale_name TEXT,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  FOREIGN KEY (offer_id) REFERENCES offers(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  mode TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  imported_products INTEGER DEFAULT 0,
  imported_offers INTEGER DEFAULT 0,
  error_text TEXT
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  region TEXT NOT NULL,
  status TEXT NOT NULL,
  accepted_offer INTEGER NOT NULL,
  comment TEXT,
  cart_snapshot_json TEXT NOT NULL,
  payment_provider TEXT,
  payment_id TEXT,
  payment_status TEXT,
  payment_confirmation_url TEXT,
  fulfillment_mode TEXT NOT NULL DEFAULT 'manual',
  paid_at TEXT,
  issued_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS top_up_denominations (
  nominal_try INTEGER PRIMARY KEY,
  price_rub_minor INTEGER NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS top_up_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nominal_try INTEGER NOT NULL,
  code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  order_id INTEGER,
  added_at TEXT NOT NULL,
  sold_at TEXT,
  FOREIGN KEY (nominal_try) REFERENCES top_up_denominations(nominal_try),
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_top_up_codes_nominal_status
  ON top_up_codes(nominal_try, status, id);

CREATE TABLE IF NOT EXISTS order_code_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL,
  top_up_code_id INTEGER,
  nominal_try INTEGER NOT NULL,
  code_snapshot TEXT NOT NULL,
  assigned_at TEXT NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (top_up_code_id) REFERENCES top_up_codes(id)
);

CREATE TABLE IF NOT EXISTS fulfillment_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  mode TEXT NOT NULL DEFAULT 'manual',
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_details (
  product_id INTEGER PRIMARY KEY,
  locale TEXT NOT NULL,
  release_date TEXT,
  edition_name TEXT,
  publisher_name TEXT,
  top_category TEXT,
  privacy_policy TEXT,
  content_rating TEXT,
  hero_background_url TEXT,
  logo_url TEXT,
  master_image_url TEXT,
  long_description TEXT,
  compatibility_notice TEXT,
  legal_text TEXT,
  genres_json TEXT NOT NULL,
  spoken_languages_json TEXT NOT NULL,
  screen_languages_json TEXT NOT NULL,
  compatibility_json TEXT NOT NULL,
  rating_json TEXT NOT NULL,
  media_json TEXT NOT NULL,
  editions_json TEXT NOT NULL DEFAULT '[]',
  add_ons_json TEXT NOT NULL,
  sale_end_at TEXT,
  lowest_recent_price TEXT,
  source_updated_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS product_translations (
  product_id INTEGER NOT NULL,
  field TEXT NOT NULL,
  locale TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  text TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (product_id, field, locale),
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ps_plus_prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  region TEXT NOT NULL,
  tier TEXT NOT NULL,
  duration_months INTEGER NOT NULL,
  price_rub_minor INTEGER,
  is_active INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL,
  UNIQUE(region, tier, duration_months)
);

CREATE TABLE IF NOT EXISTS home_banners (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  image_url TEXT NOT NULL,
  image_position_x INTEGER NOT NULL DEFAULT 50,
  image_position_y INTEGER NOT NULL DEFAULT 50,
  image_scale REAL NOT NULL DEFAULT 1,
  link_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS home_banner_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  autoplay_ms INTEGER NOT NULL DEFAULT 6000,
  animation TEXT NOT NULL DEFAULT 'slide',
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_title ON products(title_normalized);
CREATE INDEX IF NOT EXISTS idx_offers_region ON offers(region);
CREATE INDEX IF NOT EXISTS idx_product_source_ranks_lookup ON product_source_ranks(tag, region, rank);
CREATE INDEX IF NOT EXISTS idx_price_history_product_checked ON price_history(product_id, checked_at DESC);

CREATE TABLE IF NOT EXISTS proxies (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'http',
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  username TEXT NOT NULL DEFAULT '',
  password TEXT NOT NULL DEFAULT '',
  region TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  last_checked TEXT,
  last_response_time_ms INTEGER,
  last_http_code INTEGER,
  error_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS proxy_checks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proxy_id INTEGER NOT NULL,
  checked_at TEXT NOT NULL,
  response_time_ms INTEGER,
  http_code INTEGER,
  status TEXT NOT NULL,
  error_message TEXT,
  FOREIGN KEY (proxy_id) REFERENCES proxies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS parse_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,
  region TEXT NOT NULL,
  product_ids TEXT,
  proxy_id INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  total_items INTEGER NOT NULL DEFAULT 0,
  processed_items INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT,
  error_message TEXT,
  FOREIGN KEY (proxy_id) REFERENCES proxies(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON parse_tasks(status, created_at);
CREATE INDEX IF NOT EXISTS idx_proxies_region_status ON proxies(region, status);
`
