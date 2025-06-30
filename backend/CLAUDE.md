# CLAUDE.md - Projet E-commerce Backend AdonisJS

## 🎯 Vue d'ensemble du Projet

**Objectif**: Développer un backend e-commerce multi-tenant complet avec AdonisJS v6 en 3 jours intensifs, prêt pour l'intégration frontend.

**Architecture**: Monolithe modulaire avec séparation des domaines selon les principes DDD (Domain-Driven Design).

**Stack Technique**:

- **Framework**: AdonisJS v6 (TypeScript, ESM)
- **Base de données**: PostgreSQL
- **Authentification**: JWT avec `@maximemrf/adonisjs-jwt`
- **ORM**: Lucid (AdonisJS)
- **Validation**: VineJS
- **Tests**: Japa (should have)

---

## 🏗️ Architecture Modulaire

### Principe DDD Appliqué

**Séparation des préoccupations**:

- **Auth Module**: Authentification (AuthN) et Autorisation (AuthZ) uniquement
- **User Module**: Gestion des utilisateurs et profils (domaine métier)
- **Autres modules**: Chacun avec sa responsabilité spécifique

### Structure des Modules

````

app/modules/
├── auth/ # P0 - Sécurité & Accès
│ ├── controllers/
│ ├── services/
│ ├── middleware/
│ ├── validators/
│ ├── exceptions/
│ ├── events/
│ └── routes/
├── user/ # P0 - Gestion Utilisateurs
├── tenant/ # P0 - Multi-tenant
├── rbac/ # P1 - Rôles & Permissions
├── catalog/ # P0 - Produits & Catalogue
├── cart/ # P0 - Panier d'achat
├── order/ # P0 - Commandes
├── payment/ # P1 - Paiements
├── delivery/ # P1 - Livraisons
└── notification/ # P2 - Notifications

````

### Commande Make:Module

```bash
# Générer un nouveau module
node ace make:module [name] -m -migration -t -d [domain]

# Exemples
node ace make:module auth -d security
node ace make:module user -m -migration -t -d user_management
node ace make:module catalog -m -migration -d commerce
````

---

## 🗄️ Schéma de Base de Données Complet

### Tables Core (Authentication & Users)

#### **users**

```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    email_verified_at TIMESTAMP NULL,
    remember_me_token VARCHAR(255) NULL,
    status VARCHAR(20) CHECK (status IN ('active', 'inactive', 'suspended')) DEFAULT 'active',
    last_login_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### **user_profiles**

```sql
CREATE TABLE user_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    phone VARCHAR(20),
    date_of_birth DATE,
    profile_picture_url VARCHAR(255),
    preferred_language VARCHAR(10) DEFAULT 'fr',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Tables Multi-Tenant

#### **tenants**

```sql
CREATE TABLE tenants (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    domain VARCHAR(255) UNIQUE NULL,
    description TEXT,
    logo VARCHAR(255),
    settings JSONB DEFAULT '{}',
    status VARCHAR(20) CHECK (status IN ('active', 'inactive', 'suspended')) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### **user_tenants** (Many-to-Many)

```sql
CREATE TABLE user_tenants (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    status VARCHAR(20) CHECK (status IN ('active', 'inactive', 'pending')) DEFAULT 'active',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, tenant_id)
);
```

### Tables RBAC (Role-Based Access Control)

#### **roles**

```sql
CREATE TABLE roles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    description TEXT,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, tenant_id)
);
```

#### **permissions**

```sql
CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, tenant_id)
);
```

#### **role_permissions** & **user_roles**

```sql
CREATE TABLE role_permissions (
    id SERIAL PRIMARY KEY,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER REFERENCES permissions(id) ON DELETE CASCADE,
    UNIQUE(role_id, permission_id)
);

CREATE TABLE user_roles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER REFERENCES roles(id) ON DELETE CASCADE,
    UNIQUE(user_id, role_id)
);
```

### Tables E-commerce

#### **categories** (Hiérarchique)

```sql
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(slug, tenant_id)
);
```

#### **products**

```sql
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    description TEXT,
    short_description VARCHAR(500),
    sku VARCHAR(100) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    compare_price DECIMAL(10,2),
    cost_price DECIMAL(10,2),
    track_inventory BOOLEAN DEFAULT true,
    status VARCHAR(20) CHECK (status IN ('active', 'inactive', 'draft')) DEFAULT 'draft',
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(slug, tenant_id),
    UNIQUE(sku, tenant_id)
);
```

#### **product_images**

```sql
CREATE TABLE product_images (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    url VARCHAR(255) NOT NULL,
    alt_text VARCHAR(255),
    is_primary BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### **category_products** (Many-to-Many)

```sql
CREATE TABLE category_products (
    id SERIAL PRIMARY KEY,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    UNIQUE(category_id, product_id)
);
```

#### **inventory**

```sql
CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 0,
    reserved_quantity INTEGER DEFAULT 0,
    location VARCHAR(100),
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(product_id, tenant_id)
);
```

#### **carts** & **cart_items**

```sql
CREATE TABLE carts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    status VARCHAR(20) CHECK (status IN ('active', 'converted', 'abandoned')) DEFAULT 'active',
    session_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, tenant_id)
);

CREATE TABLE cart_items (
    id SERIAL PRIMARY KEY,
    cart_id INTEGER REFERENCES carts(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(cart_id, product_id)
);
```

#### **addresses** (Refactorisée - Plus clean)

```sql
CREATE TABLE addresses (
    id SERIAL PRIMARY KEY,
    label VARCHAR(100), -- 'Domicile', 'Bureau', 'Chez mes parents'
    address_line_1 VARCHAR(255) NOT NULL,
    address_line_2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100), -- Région pour le Sénégal
    postal_code VARCHAR(20),
    country VARCHAR(100) NOT NULL DEFAULT 'Sénégal',
    landmark VARCHAR(255), -- Point de repère (très important au Sénégal)
    delivery_instructions TEXT, -- Instructions spéciales de livraison
    coordinates POINT, -- Coordonnées GPS (latitude, longitude)
    is_verified BOOLEAN DEFAULT false, -- Adresse vérifiée par GPS/livreur
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table de liaison pour associer adresses aux utilisateurs
CREATE TABLE user_addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    address_id INTEGER REFERENCES addresses(id) ON DELETE CASCADE,
    contact_person VARCHAR(100), -- Qui contacter à cette adresse
    phone VARCHAR(20), -- Téléphone spécifique à cette adresse
    type VARCHAR(20) CHECK (type IN ('billing', 'shipping', 'both')) DEFAULT 'both',
    is_default BOOLEAN DEFAULT false,
    notes TEXT, -- Notes spéciales pour cette adresse
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, address_id, type)
);

-- Index pour les requêtes fréquentes
CREATE INDEX idx_user_addresses_user_default ON user_addresses(user_id, is_default);
CREATE INDEX idx_addresses_tenant ON addresses(tenant_id);
CREATE INDEX idx_addresses_city ON addresses(city);
```

#### **Comparaison Avant/Après**

**❌ AVANT (Surchargée):**

```sql
CREATE TABLE addresses (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id),
    first_name VARCHAR(50) NOT NULL,     -- ← Répète user_profile
    last_name VARCHAR(50) NOT NULL,      -- ← Répète user_profile
    company VARCHAR(100),                -- ← Optionnel, peut être dans profile
    address_line_1 VARCHAR(255) NOT NULL,
    address_line_2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) NOT NULL,
    phone VARCHAR(20),                   -- ← Répète user_profile
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

**✅ APRÈS (Optimisée):**

```sql
CREATE TABLE addresses (
    id SERIAL PRIMARY KEY,
    label VARCHAR(100),                  -- ✅ Plus descriptif
    address_line_1 VARCHAR(255) NOT NULL,
    address_line_2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Sénégal',
    landmark VARCHAR(255),               -- ✅ Spécifique au contexte sénégalais
    delivery_instructions TEXT,          -- ✅ Instructions de livraison
    coordinates POINT,                   -- ✅ GPS pour géolocalisation
    is_verified BOOLEAN DEFAULT false,   -- ✅ Validation par livreur
    tenant_id INTEGER REFERENCES tenants(id),
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE user_addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    address_id INTEGER REFERENCES addresses(id),
    contact_person VARCHAR(100),         -- ✅ Qui contacter (peut être différent)
    phone VARCHAR(20),                   -- ✅ Téléphone spécifique à l'adresse
    type VARCHAR(20) CHECK (type IN ('billing', 'shipping', 'both')),
    is_default BOOLEAN DEFAULT false,
    notes TEXT,                          -- ✅ Notes spéciales
    created_at TIMESTAMP
);
```

### **Avantages de cette Approche :**

#### **1. Séparation des Préoccupations**

- **Adresses** : Uniquement les informations géographiques
- **User_Addresses** : Relation et contexte d'utilisation
- **User_Profile** : Informations personnelles de l'utilisateur

#### **2. Réutilisabilité**

```sql
-- Une adresse peut être utilisée par plusieurs utilisateurs (famille, bureau)
INSERT INTO user_addresses (user_id, address_id, contact_person, phone, type) VALUES
(1, 100, 'John Doe', '+221701234567', 'shipping'),
(2, 100, 'Jane Doe', '+221707654321', 'shipping'); -- Même adresse, contacts différents
```

#### **3. Flexibilité Contexte Sénégalais**

```sql
-- Exemple d'adresse sénégalaise typique
INSERT INTO addresses (
    label,
    address_line_1,
    city,
    state,
    country,
    landmark,
    delivery_instructions,
    coordinates
) VALUES (
    'Domicile',
    'Cité Keur Gorgui, Villa N°25',
    'Dakar',
    'Dakar',
    'Sénégal',
    'Face à la mosquée Keur Gorgui, portail bleu',
    'Appeler 15 minutes avant la livraison. Demander Aminata au gardien.',
    POINT(14.6928, -17.4467)
);
```

#### **4. Gestion Multi-Contact**

```sql
-- Un utilisateur peut avoir des contacts différents selon l'adresse
INSERT INTO user_addresses (user_id, address_id, contact_person, phone, type, notes) VALUES
(1, 101, 'Amadou Diallo', '+221701234567', 'shipping', 'Mon frère, disponible 8h-18h'),
(1, 102, 'Fatou Sall', '+221707654321', 'shipping', 'Ma sœur, disponible week-end uniquement');
```

### **Modèles Mis à Jour**

#### **Address Model**

```typescript
export default class Address extends BaseModel {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare label: string | null

  @column()
  declare addressLine1: string

  @column()
  declare addressLine2: string | null

  @column()
  declare city: string

  @column()
  declare state: string | null

  @column()
  declare postalCode: string | null

  @column()
  declare country: string

  @column()
  declare landmark: string | null

  @column()
  declare deliveryInstructions: string | null

  @column()
  declare coordinates: string | null // Stocké comme "lat,lng"

  @column()
  declare isVerified: boolean

  @column()
  declare tenantId: number

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime

  // Relations
  @manyToMany(() => User, {
    pivotTable: 'user_addresses',
    pivotColumns: ['contact_person', 'phone', 'type', 'is_default', 'notes'],
  })
  declare users: ManyToMany<typeof User>

  // Helpers
  get fullAddress(): string {
    const parts = [
      this.addressLine1,
      this.addressLine2,
      this.city,
      this.state,
      this.postalCode,
      this.country,
    ].filter(Boolean)

    return parts.join(', ')
  }

  get googleMapsUrl(): string | null {
    if (!this.coordinates) return null
    return `https://maps.google.com/maps?q=${this.coordinates}`
  }
}
```

#### **UserAddress Model (Pivot)**

```typescript
export default class UserAddress extends BaseModel {
  static table = 'user_addresses'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare userId: number

  @column()
  declare addressId: number

  @column()
  declare contactPerson: string | null

  @column()
  declare phone: string | null

  @column()
  declare type: 'billing' | 'shipping' | 'both'

  @column()
  declare isDefault: boolean

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  // Relations
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  @belongsTo(() => Address)
  declare address: BelongsTo<typeof Address>
}
```

Cette approche est **beaucoup plus propre et flexible** ! 🎯

#### **orders** & **order_items** (Mis à jour pour COD)

```sql
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    order_number VARCHAR(50) UNIQUE NOT NULL,

    -- Statuts adaptés pour COD
    status VARCHAR(30) CHECK (status IN (
        'pending',           -- En attente (panier converti)
        'confirmed',         -- Confirmée (stock réservé)
        'processing',        -- En préparation
        'ready_for_pickup',  -- Prête pour collecte (COD)
        'out_for_delivery',  -- En cours de livraison (COD)
        'payment_pending',   -- Paiement en attente à la livraison (COD)
        'paid',             -- Payée (carte/mobile money OU COD collecté)
        'delivered',        -- Livrée et payée
        'failed_delivery',  -- Échec de livraison (COD refusé/absent)
        'returned',         -- Retournée (après échec COD)
        'cancelled',        -- Annulée
        'refunded'          -- Remboursée
    )) DEFAULT 'pending',

    -- Type de paiement
    payment_method VARCHAR(30) CHECK (payment_method IN (
        'cash_on_delivery',  -- Paiement à la livraison
        'orange_money',      -- Orange Money Sénégal
        'free_money',        -- Free Money (Tigo)
        'wave',             -- Wave
        'credit_card',      -- Carte bancaire
        'bank_transfer',    -- Virement
        'cheque'           -- Chèque
    )) NOT NULL,

    -- Addresses
    shipping_address_id INTEGER REFERENCES addresses(id),
    billing_address_id INTEGER REFERENCES addresses(id),

    -- Amounts (en XOF pour le Sénégal)
    subtotal DECIMAL(12,2) NOT NULL, -- Montants plus élevés en XOF
    tax_amount DECIMAL(12,2) DEFAULT 0,
    shipping_amount DECIMAL(12,2) DEFAULT 0,
    cod_fee DECIMAL(12,2) DEFAULT 0, -- Frais COD spécifiques
    discount_amount DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'XOF', -- Franc CFA

    -- COD specific fields
    cod_instructions TEXT, -- Instructions spéciales pour le livreur COD
    cod_collected_amount DECIMAL(12,2), -- Montant réellement collecté
    cod_collection_notes TEXT, -- Notes du livreur sur la collecte

    -- Timestamps
    confirmed_at TIMESTAMP,
    ready_at TIMESTAMP, -- Prête pour livraison
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP,
    payment_collected_at TIMESTAMP, -- Quand le paiement COD a été collecté

    -- Metadata
    notes TEXT,
    internal_notes TEXT, -- Notes internes (pas visibles client)
    delivery_attempts INTEGER DEFAULT 0, -- Nombre de tentatives de livraison

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(12,2) NOT NULL, -- Prix en XOF
    total_price DECIMAL(12,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour optimiser les requêtes par statut et méthode de paiement
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_payment_method ON orders(payment_method);
CREATE INDEX idx_orders_cod_status ON orders(status, payment_method) WHERE payment_method = 'cash_on_delivery';
```

### **Workflow des Statuts avec COD**

#### **Workflow Standard (Paiement Électronique)**

```
pending → confirmed → processing → shipped → delivered
   ↓         ↓           ↓          ↓
cancelled ← cancelled ← cancelled ← failed_delivery → returned
                                    ↓
                                 refunded
```

#### **Workflow COD (Cash on Delivery)**

```
pending → confirmed → processing → ready_for_pickup → out_for_delivery
   ↓         ↓           ↓              ↓                    ↓
cancelled ← cancelled ← cancelled ← cancelled          payment_pending
                                                            ↓
                                                         paid → delivered
                                                            ↓
                                                     failed_delivery
                                                            ↓
                                                      returned → refunded
```

#### **Détails des Statuts COD**

| Statut             | Description                             | Actions Possibles          | Responsable        |
| ------------------ | --------------------------------------- | -------------------------- | ------------------ |
| `pending`          | Commande créée, en attente confirmation | confirmer, annuler         | Admin/Auto         |
| `confirmed`        | Stock réservé, commande validée         | traiter, annuler           | Admin              |
| `processing`       | En cours de préparation                 | prête pour collecte        | Équipe préparation |
| `ready_for_pickup` | Prête pour collecte par livreur         | assigner livreur           | Admin              |
| `out_for_delivery` | En cours de livraison                   | livré, échec               | Livreur            |
| `payment_pending`  | À l'adresse, en attente paiement        | paiement collecté, échec   | Livreur            |
| `paid`             | Paiement collecté avec succès           | livré                      | Livreur            |
| `delivered`        | Livrée et payée                         | -                          | -                  |
| `failed_delivery`  | Échec de livraison (absent/refus)       | nouvelle tentative, retour | Livreur            |
| `returned`         | Retournée au dépôt                      | rembourser                 | Admin              |

### **Endpoints Spécifiques COD**

```typescript
// Routes supplémentaires pour COD
router
  .group(() => {
    // Livreur confirme l'arrivée et demande paiement
    router.post('/orders/:id/request-payment', [OrderController, 'requestPayment'])

    // Livreur confirme la collecte du paiement
    router.post('/orders/:id/confirm-payment', [OrderController, 'confirmPayment'])

    // Livreur signale un échec de livraison
    router.post('/orders/:id/report-delivery-failure', [OrderController, 'reportDeliveryFailure'])

    // Programmer une nouvelle tentative
    router.post('/orders/:id/schedule-retry', [OrderController, 'scheduleRetry'])
  })
  .prefix('/api/delivery')
  .middleware(['auth', 'tenant'])
```

Cette approche intègre complètement le workflow COD spécifique au contexte sénégalais ! 🇸🇳

#### **payments**

```sql
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'EUR',
    method VARCHAR(50) NOT NULL,
    status VARCHAR(20) CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
    gateway VARCHAR(50),
    gateway_transaction_id VARCHAR(255),
    gateway_response JSONB,
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### **delivery_zones**, **deliveries**, **delivery_people**

```sql
CREATE TABLE delivery_zones (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    cities JSONB NOT NULL DEFAULT '[]',
    postal_codes JSONB NOT NULL DEFAULT '[]',
    delivery_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    free_delivery_threshold DECIMAL(10,2),
    estimated_delivery_time VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE delivery_people (
    id SERIAL PRIMARY KEY,
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    vehicle_type VARCHAR(50),
    license_number VARCHAR(100),
    status VARCHAR(20) CHECK (status IN ('active', 'inactive', 'busy')) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE deliveries (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    delivery_person_id INTEGER REFERENCES delivery_people(id),
    delivery_zone_id INTEGER REFERENCES delivery_zones(id),
    tracking_number VARCHAR(100) UNIQUE,
    status VARCHAR(20) CHECK (status IN ('assigned', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'failed', 'returned')) DEFAULT 'assigned',
    scheduled_at TIMESTAMP,
    picked_up_at TIMESTAMP,
    delivered_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 📊 Spécifications des Modules Critiques (P0)

### 🔐 MODULE AUTH (Authentification & Autorisation)

**Responsabilités**:

- Authentification (AuthN): "Qui êtes-vous ?"
- Autorisation (AuthZ): "Que pouvez-vous faire ?"
- Gestion des tokens JWT
- Sessions et sécurité
- Audit des connexions

**Endpoints Principaux**:

- `POST /auth/login` - Connexion utilisateur
- `POST /auth/logout` - Déconnexion
- `GET /auth/me` - Profil utilisateur actuel
- `POST /auth/validate-token` - Validation token
- `POST /auth/refresh` - Renouvellement token

**Middleware de Sécurité**:

**Endpoints CRUD Complets**:

- `GET /users` - Liste paginée avec filtres
- `POST /users` - Création utilisateur
- `PUT /users/:id` - Mise à jour utilisateur
- `DELETE /users/:id` - Suppression utilisateur
- `PUT /users/:id/profile` - Mise à jour profil
- `GET /users/me/profile` - Profil personnel
- `PUT /users/me/change-password` - Changement mot de passe

---

### 🏢 MODULE TENANT (Multi-Tenant)

**Responsabilités**:

- Isolation des données par tenant
- Gestion des contextes tenant
- Configuration par tenant
- Domaines et sous-domaines
- Thèmes et personnalisation

**Résolution Multi-Tenant**:

**Headers Multi-Tenant**:

```
Authorization: Bearer {token}
Content-Type: application/json
X-Tenant-Slug: apple-store  ← ESSENTIEL
```

---

### 🛍️ MODULE CATALOG (Produits & Catalogue)

**Responsabilités**:

- CRUD produits complet
- Système de catégories hiérarchique
- Gestion des stocks (inventory)
- Upload et gestion d'images
- Recherche et filtres avancés
- SEO et URLs friendly

**Fonctionnalités Avancées**:

- **Recherche multi-critères**: nom, catégorie, prix, stock
- **Filtres dynamiques**: marque, prix, disponibilité
- **Pagination optimisée**: performance avec grandes collections
- **Gestion d'images**: upload, redimensionnement, optimisation
- **Variations produits**: couleurs, tailles, options
- **SEO**: meta descriptions, URLs optimisées

**Endpoints Critiques**:

- `GET /products` - Liste avec filtres et pagination
- `GET /products/search` - Recherche avancée avec facettes
- `POST /products` - Création produit avec validation
- `PUT /products/:id/inventory` - Gestion stocks
- `POST /products/:id/images` - Upload images

---

### 🛒 MODULE CART (Panier d'Achat)

**Responsabilités**:

- Gestion du panier utilisateur
- Calculs automatiques (sous-total, taxes, livraison)
- Persistance entre sessions
- Gestion des stocks en temps réel
- Application de coupons/promotions

### 📦 MODULE ORDERS (Commandes)

**Responsabilités**:

- Workflow complet de commande
- Gestion des statuts (pending → paid → shipped → delivered)
- Calculs avec taxes et frais de livraison
- Gestion des adresses de livraison/facturation
- Historique et suivi
- Intégration avec paiements et livraisons

**Workflow des Statuts**:

```
pending → paid → processing → shipped → delivered
    ↓       ↓         ↓         ↓
cancelled ← cancelled ← cancelled ← returned
                                    ↓
                                refunded
```

**Endpoints Critiques**:

- `POST /orders` - Création depuis panier avec validation complète
- `GET /orders/:id` - Détails avec timeline et tracking
- `PUT /orders/:id/status` - Mise à jour statut avec workflow
- `POST /orders/:id/cancel` - Annulation avec remise en stock
- `GET /orders/:id/tracking` - Suivi de livraison

---

### **Codes HTTP Standard**

| Code | Description           | Usage                    |
| ---- | --------------------- | ------------------------ |
| 200  | OK                    | GET, PUT réussis         |
| 201  | Created               | POST réussi              |
| 204  | No Content            | DELETE réussi            |
| 400  | Bad Request           | Erreurs de validation    |
| 401  | Unauthorized          | Authentification requise |
| 403  | Forbidden             | Permission refusée       |
| 404  | Not Found             | Ressource non trouvée    |
| 409  | Conflict              | Ressource dupliquée      |
| 422  | Unprocessable Entity  | Validation échouée       |
| 429  | Too Many Requests     | Rate limit dépassé       |
| 500  | Internal Server Error | Erreur serveur           |

---

## 🧪 Stratégie de Tests

### **Tests Unitaires** (Should Have - 20% du temps)

```typescript
// Exemple: Auth Service Tests
import { test } from '@japa/runner'
import AuthenticationService from '#modules/auth/services/authentication_service'

test.group('Authentication Service', () => {
  test('should authenticate valid user', async ({ assert }) => {
    const authService = new AuthenticationService()
    const credentials = {
      email: 'admin@example.com',
      password: 'password123',
    }

    const result = await authService.authenticate(credentials, mockAuth)

    assert.isTrue(result.user.id > 0)
    assert.isString(result.tokens.accessToken)
    assert.equal(result.tokens.expiresIn, 7200)
  })

  test('should throw error for invalid credentials', async ({ assert }) => {
    const authService = new AuthenticationService()
    const credentials = {
      email: 'invalid@example.com',
      password: 'wrongpassword',
    }

    await assert.rejects(
      () => authService.authenticate(credentials, mockAuth),
      'Email ou mot de passe incorrect'
    )
  })
})
```

### **Coverage Target**

- **Modules critiques**: 80%+ coverage
- **Services métier**: 90%+ coverage
- **Contrôleurs**: 70%+ coverage
- **Middleware**: 85%+ coverage
 Installation Initiale**

### **2. Configuration Base de Données**

### **4. Test des APIs**

```bash
# Test de santé
curl http://localhost:3333/api/health

# Test de login
curl -X POST http://localhost:3333/api/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Tenant-Slug: test-store" \
  -d '{"email":"admin@example.com","password":"password123"}'

# Test avec token (remplacer TOKEN)
curl -X GET http://localhost:3333/api/auth/me \
  -H "Authorization: Bearer TOKEN" \
  -H "X-Tenant-Slug: test-store"
```

## 🎯 Definition of Done

### **Feature "Done" Criteria**

```
Une feature est "Done" quand:
□ Code implémenté et fonctionnel
□ Tests unitaires passent (coverage > 70%)
□ Documentation API à jour
□ Testé manuellement via Postman
□ Code review (self-review OK)
□ Git commit avec message descriptif
□ Integration avec modules existants validée
□ Gestion d'erreurs implémentée
□ Validation des données en place
□ Logs et audit configurés
```

### **API Endpoint "Ready" Criteria**

```
Un endpoint est "Ready" quand:
□ Headers requis documentés
□ Paramètres validés avec Vine
□ Réponses standardisées (success/error)
□ Codes HTTP appropriés
□ Gestion d'erreurs complète
□ Tests d'intégration passent
□ Documentation Postman à jour
□ Middleware de sécurité appliqué
□ Rate limiting configuré (si nécessaire)
□ Logs d'audit en place
```

### **Module "Production Ready" Criteria**

```
Un module est "Production Ready" quand:
□ Tous les endpoints sont "Ready"
□ Tests de charge validés
□ Sécurité auditée
□ Performance optimisée
□ Monitoring en place
□ Documentation technique complète
□ Gestion d'erreurs robuste
□ Rollback stratégies définies
□ Environment variables sécurisées
□ Backup/restore procédures documentées
```

---

## 📊 Métriques de Succès

### **Objectifs Techniques**

- **71 endpoints** documentés et fonctionnels
- **Coverage tests** > 70% sur modules critiques
- **Performance** < 200ms response time average
- **Sécurité** audit complet passé
- **Documentation** API complète et à jour

### **Objectifs Business**

- **Workflow e-commerce** complet end-to-end
- **Multi-tenant** isolation validée
- **Scalabilité** architecture prête pour 1000+ tenants
- **Maintenance** code modulaire et maintenable
- **Deployment** prêt pour production

### **Ready for Frontend**

- ✅ 50+ API endpoints documentés
- ✅ Authentication flow complet
- ✅ E-commerce workflow end-to-end
- ✅ Error handling standardisé
- ✅ CORS configuré pour frontend
- ✅ Environment variables setup
- ✅ Rate limiting implémenté
- ✅ Security audit passé

---

## 🏁 Conclusion

Ce backend e-commerce AdonisJS modulaire représente une architecture moderne, scalable et sécurisée, prête pour le développement en 3 jours intensifs.

**Points forts de l'architecture**:

- **Modularité**: Séparation claire des domaines (DDD)
- **Sécurité**: JWT robuste avec validation complète
- **Multi-tenant**: Isolation parfaite des données
- **Scalabilité**: Architecture prête pour croissance
- **Maintenabilité**: Code organisé et documenté
