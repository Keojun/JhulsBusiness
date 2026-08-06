-- Run this in Supabase SQL Editor to restore home page Facebook reviews
-- Safe to run after deleting test data

INSERT INTO facebook_reviews (author, text, stars, source, verified) VALUES
  ('Customer', 'Legit po! Fast transaction and mabait si Jhul. Highly recommended for gakuran rerolls!', 5, 'Facebook', true),
  ('Roblox Player', 'Got my rerolls quickly after payment. Very trustworthy seller, will order again.', 5, 'Facebook', true),
  ('Gakuran Buyer', 'Smooth process — message, QR, then private server. Everything went as described.', 5, 'Facebook', true),
  ('Repeat Client', 'Been ordering rerolls here multiple times. Always reliable and fair.', 5, 'Facebook', true),
  ('New Customer', 'First time buyer, was nervous but Jhul guided me through the whole process. 10/10!', 5, 'Facebook', true),
  ('Happy Gamer', 'Salamat po! Worth it yung rerolls, legit seller talaga.', 5, 'Facebook', true);
