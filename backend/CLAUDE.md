### Tables RBAC avec Resources (Role-Based Access Control)

#### **resources** (Nouvelle table pour permissions dynamiques)

```sql
CREATE TABLE resources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL, -- 'order', 'product', 'user'
    display_name VARCHAR(100) NOT NULL, -- 'Commandes', 'Produits', 'Utilisateurs'
    description TEXT,
    table_name VARCHAR(100) NOT NULL, -- Nom de la table correspondante
    available_actions JSONB NOT NULL DEFAULT '[]', -- ['create', 'read', 'update', 'delete', 'list']
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(name, tenant_id)
);

-- Resources de base pour chaque tenant
INSERT INTO resources (name, display_name, table_name, available_actions, tenant_id) VALUES
('user', 'Utilisateurs', 'users', '["create", "read", "update", "delete", "list", "activate", "deactivate"]', 1),
('product', 'Produits', 'products', '["create", "read", "update", "delete", "list", "publish", "unpublish"]', 1),
('order', 'Commandes', 'orders', '["create", "read", "update", "delete", "list", "cancel", "ship", "refund"]', 1),
('payment', 'Paiements', 'payments', '["create", "read", "update", "list", "refund", "capture"]', 1),
('delivery', 'Livraisons', 'deliveries', '["create", "read", "update", "delete", "list", "assign", "track"]', 1);
```

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

#### **permissions** (Refactorisé pour être resource-based)

```sql
CREATE TABLE permissions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL, -- 'create:order', 'read:product'
    resource_id INTEGER REFERENCES resources(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'create', 'read', 'update', 'delete', 'list'
    scope VARCHAR(50) DEFAULT 'all', -- 'all', 'own', 'tenant'
    tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(resource_id, action, tenant_id)
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

### Tables JWT Refresh Tokens

#### **jwt_refresh_tokens**

````sql
CREATE TABLE jwt_refresh_tokens (
    id SERIAL PRIMARY KEY,
    tokenable_id INTEGER NOT NULL, -- user_id
    type VARCHAR(255) NOT NULL DEFAULT 'jwt_refresh_token',
    name VARCHAR(255) NULL,
    hash VARCHAR(80) NOT NULL,
    abilities TEXT NOT NULL,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP(6) WITH TIME ZONE NULL,
    last_used_at TIMESTAMP(6) WITH TIME ZONE NULL,

    -- Index pour optimiser les performances
    INDEX idx_tokenable_type (tokenable_id, type),
    INDEX idx_hash (hash),
    INDEX idx_expires_at (expires_at)
);
```# CLAUDE.md - Projet E-commerce Backend AdonisJS

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

### **Service d'Adresses**

```typescript
export default class AddressService {
  async createUserAddress(userId: number, addressData: CreateAddressData) {
    return await Database.transaction(async (trx) => {
      // 1. Créer ou trouver l'adresse
      let address = await this.findSimilarAddress(addressData, trx)

      if (!address) {
        address = await Address.create(
          {
            ...addressData,
            tenantId: addressData.tenantId,
          },
          { client: trx }
        )
      }

      // 2. Associer à l'utilisateur
      const userAddress = await UserAddress.create(
        {
          userId,
          addressId: address.id,
          contactPerson: addressData.contactPerson,
          phone: addressData.phone,
          type: addressData.type || 'both',
          isDefault: addressData.isDefault || false,
          notes: addressData.notes,
        },
        { client: trx }
      )

      // 3. Si c'est l'adresse par défaut, désactiver les autres
      if (userAddress.isDefault) {
        await UserAddress.query({ client: trx })
          .where('user_id', userId)
          .where('type', userAddress.type)
          .where('id', '!=', userAddress.id)
          .update({ is_default: false })
      }

      return userAddress
    })
  }

  private async findSimilarAddress(addressData: any, trx: any): Promise<Address | null> {
    // Chercher une adresse similaire pour éviter les doublons
    return await Address.query({ client: trx })
      .where('address_line_1', addressData.addressLine1)
      .where('city', addressData.city)
      .where('tenant_id', addressData.tenantId)
      .first()
  }
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

### **Service de Commande avec COD**

```typescript
export default class OrderService {
  async createOrderWithCOD(orderData: CreateOrderData): Promise<Order> {
    return await Database.transaction(async (trx) => {
      // 1. Créer la commande avec statut et type appropriés
      const order = await this.createFromCart(orderData, trx)

      // 2. Workflow spécifique selon le type de paiement
      if (orderData.paymentMethod === 'cash_on_delivery') {
        // COD: Passer directement en "confirmed" (pas de paiement à vérifier)
        order.status = 'confirmed'
        order.confirmedAt = DateTime.now()

        // Calculer les frais COD
        const codFee = await this.calculateCODFee(order.shippingAddressId, order.totalAmount)
        order.codFee = codFee
        order.totalAmount += codFee

        // Instructions COD par défaut
        order.codInstructions = `Montant à collecter: ${order.totalAmount} XOF. Vérifier l'identité avant remise du colis.`

        await order.save({ client: trx })

        // Créer automatiquement un "payment" en attente
        await Payment.create(
          {
            orderId: order.id,
            amount: order.totalAmount,
            currency: 'XOF',
            method: 'cash_on_delivery',
            status: 'pending_collection', // Statut spécial COD
            notes: 'Paiement à collecter lors de la livraison',
          },
          { client: trx }
        )
      } else {
        // Paiement électronique: rester en "pending" en attendant le paiement
        order.status = 'pending'
        await order.save({ client: trx })
      }

      // 3. Émettre l'événement approprié
      await emitter.emit('order:created', {
        orderId: order.id,
        paymentMethod: order.paymentMethod,
        isCOD: order.paymentMethod === 'cash_on_delivery',
      })

      return order
    })
  }

  async updateOrderStatus(orderId: number, newStatus: OrderStatus, data?: any): Promise<Order> {
    const order = await Order.findOrFail(orderId)
    const oldStatus = order.status

    // Validation des transitions selon le type de paiement
    const validTransitions = this.getValidTransitions(order.paymentMethod)

    if (!validTransitions[oldStatus]?.includes(newStatus)) {
      throw new InvalidStatusTransitionException(
        `Cannot transition from ${oldStatus} to ${newStatus} for ${order.paymentMethod}`
      )
    }

    // Actions spécifiques par statut
    await this.executeStatusActions(order, newStatus, data)

    // Mettre à jour le statut
    order.status = newStatus
    await order.save()

    // Émettre l'événement
    await emitter.emit('order:status_changed', {
      orderId: order.id,
      oldStatus,
      newStatus,
      paymentMethod: order.paymentMethod,
      data,
    })

    return order
  }

  private getValidTransitions(paymentMethod: string): Record<string, string[]> {
    const baseTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['processing', 'cancelled'],
      processing: ['ready_for_pickup', 'cancelled'], // COD workflow
      cancelled: [],
      delivered: [],
      refunded: [],
    }

    if (paymentMethod === 'cash_on_delivery') {
      return {
        ...baseTransitions,
        ready_for_pickup: ['out_for_delivery', 'cancelled'],
        out_for_delivery: ['payment_pending', 'failed_delivery', 'cancelled'],
        payment_pending: ['paid', 'failed_delivery'],
        paid: ['delivered'],
        failed_delivery: ['out_for_delivery', 'returned'], // Nouvelle tentative ou retour
        returned: ['refunded', 'out_for_delivery'], // Rembourser ou retenter
      }
    } else {
      return {
        ...baseTransitions,
        pending: ['paid', 'cancelled'], // Paiement électronique direct
        paid: ['processing'],
        processing: ['shipped'],
        shipped: ['delivered', 'failed_delivery'],
        failed_delivery: ['shipped', 'returned'],
      }
    }
  }

  private async executeStatusActions(order: Order, newStatus: string, data?: any): Promise<void> {
    switch (newStatus) {
      case 'confirmed':
        order.confirmedAt = DateTime.now()
        // Réserver le stock définitivement
        await this.reserveInventory(order)
        break

      case 'ready_for_pickup':
        order.readyAt = DateTime.now()
        // Notifier les livreurs disponibles
        await this.notifyAvailableDeliveryPersons(order)
        break

      case 'out_for_delivery':
        order.shippedAt = DateTime.now()
        // Créer la livraison si pas encore fait
        await this.createDeliveryIfNeeded(order)
        break

      case 'payment_pending':
        // Le livreur est arrivé et attend le paiement
        await this.notifyPaymentPending(order)
        break

      case 'paid':
        order.paymentCollectedAt = DateTime.now()
        if (data?.collectedAmount) {
          order.codCollectedAmount = data.collectedAmount
        }
        if (data?.collectionNotes) {
          order.codCollectionNotes = data.collectionNotes
        }
        // Mettre à jour le payment
        await this.updatePaymentStatus(order, 'completed')
        break

      case 'delivered':
        order.deliveredAt = DateTime.now()
        // Finaliser la livraison
        await this.completeDelivery(order)
        break

      case 'failed_delivery':
        order.deliveryAttempts += 1
        if (data?.reason) {
          order.codCollectionNotes = data.reason
        }
        // Programmer une nouvelle tentative si < 3 essais
        if (order.deliveryAttempts < 3) {
          await this.scheduleRetryDelivery(order)
        }
        break

      case 'returned':
        // Remettre le stock
        await this.restoreInventory(order)
        break

      case 'cancelled':
        // Remettre le stock si réservé
        if (['confirmed', 'processing', 'ready_for_pickup'].includes(order.status)) {
          await this.restoreInventory(order)
        }
        break
    }
  }

  private async calculateCODFee(shippingAddressId: number, orderAmount: number): Promise<number> {
    // Récupérer la zone de livraison
    const address = await Address.findOrFail(shippingAddressId)
    const deliveryZone = await DeliveryZone.query()
      .whereJsonSuperset('cities', [address.city])
      .first()

    if (!deliveryZone) {
      throw new DeliveryZoneNotFoundException(`Pas de zone de livraison pour ${address.city}`)
    }

    // Frais COD selon la zone (exemple: 2% du montant, min 500 XOF)
    const codFeePercent = 0.02 // 2%
    const minCodFee = 500 // 500 XOF minimum

    const calculatedFee = Math.max(orderAmount * codFeePercent, minCodFee)

    return Math.round(calculatedFee)
  }

  private async createDeliveryIfNeeded(order: Order): Promise<void> {
    const existingDelivery = await Delivery.findBy('order_id', order.id)

    if (!existingDelivery) {
      await Delivery.create({
        orderId: order.id,
        status: 'assigned',
        deliveryType: order.paymentMethod === 'cash_on_delivery' ? 'cod' : 'standard',
        amountToCollect: order.paymentMethod === 'cash_on_delivery' ? order.totalAmount : 0,
        currency: order.currency,
        trackingNumber: await this.generateTrackingNumber(),
        instructions: order.codInstructions || 'Livraison standard',
      })
    }
  }
}
```

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

---

## 🔐 Configuration JWT & Authentification

### Installation

```bash
# 1. Installer AdonisJS Auth (prérequis)
node ace add @adonisjs/auth

# 2. Installer le package JWT de Maxime Pichon
npm install @maximemrf/adonisjs-jwt

# 3. Dépendances sécurité
npm install bcryptjs
npm install --save-dev @types/bcryptjs
```

### Configuration Auth Multi-Guards

**`config/auth.ts`**

```typescript
import { defineConfig } from '@adonisjs/auth'
import { sessionGuard, sessionUserProvider } from '@adonisjs/auth/session'
import { jwtGuard } from '@maximemrf/adonisjs-jwt/jwt_config'
import { JwtGuardUser, BaseJwtContent } from '@maximemrf/adonisjs-jwt/types'
import env from '#start/env'

interface JwtContent extends BaseJwtContent {
  userId: number
  email: string
  tenantId?: number
  roles?: string[]
  permissions?: string[]
}

const authConfig = defineConfig({
  default: 'jwt',
  guards: {
    // Guard JWT principal pour API
    jwt: jwtGuard({
      secret: env.get('JWT_SECRET'),
      tokenExpiresIn: env.get('JWT_EXPIRES_IN', '2h'),
      useCookies: false, // API-first, utiliser headers

      provider: sessionUserProvider({
        model: () => import('#modules/user/models/user'),
      }),

      content: <T>(user: JwtGuardUser<T>): JwtContent => {
        const userModel = user.getOriginal() as any
        return {
          userId: user.getId(),
          email: userModel.email,
          tenantId: userModel.currentTenantId,
          roles: userModel.roles?.map((role: any) => role.name) || [],
          permissions: userModel.permissions?.map((perm: any) => perm.name) || [],
        }
      },
    }),

    // Guard JWT avec cookies pour web
    web: jwtGuard({
      secret: env.get('JWT_SECRET'),
      useCookies: true,
      tokenName: 'auth-token',
      cookieOptions: {
        httpOnly: true,
        secure: env.get('NODE_ENV') === 'production',
        sameSite: 'strict',
        maxAge: 7200,
      },

      provider: sessionUserProvider({
        model: () => import('#modules/user/models/user'),
      }),
    }),

    // Guard session pour admin
    session: sessionGuard({
      useRememberMeTokens: false,
      provider: sessionUserProvider({
        model: () => import('#modules/user/models/user'),
      }),
    }),
  },
})

export default authConfig
```

### Variables d'Environnement

```env
# JWT Configuration
JWT_SECRET=your-super-secure-256-bit-secret-key-here
JWT_EXPIRES_IN=2h
JWT_REFRESH_EXPIRES_IN=7d

# App Configuration
APP_KEY=adonis-session-app-key
NODE_ENV=development

# Database
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_DATABASE=ecommerce_db
```

---

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

```typescript
export default class JwtAuthMiddleware {
  async handle({ auth, response, request }: HttpContext, next: NextFn, guards: string[] = ['jwt']) {
    try {
      const guard = guards[0] || 'jwt'

      // 1. Validation sécurité du token
      const token = this.extractToken(request)
      if (token) {
        const validation = SecurityService.validateTokenSecurity(token)
        if (!validation.valid) {
          return this.handleTokenError(response, validation.error)
        }
      }

      // 2. Authentification AdonisJS
      await auth.use(guard).authenticate()

      // 3. Vérifications business
      const user = auth.use(guard).user
      if (!user?.isActive) {
        return response.status(403).json({
          success: false,
          message: 'Compte désactivé',
        })
      }

      await next()
    } catch (error) {
      return this.handleAuthError(error, response)
    }
  }
}
```

**Service d'Authentification**:

```typescript
export default class AuthenticationService {
  async authenticate(credentials: LoginCredentials, auth: any): Promise<AuthenticatedUser> {
    // 1. Validation des identifiants
    const user = await this.validateCredentials(credentials.email, credentials.password)

    // 2. Vérification du statut
    await this.validateUserStatus(user)

    // 3. Gestion contexte tenant
    if (credentials.tenantId) {
      await this.validateTenantAccess(user, credentials.tenantId)
    }

    // 4. Génération tokens
    const tokens = await this.generateTokens(user, auth)

    // 5. Audit et événements
    await this.updateLoginInfo(user)
    await emitter.emit('auth:user_logged_in', { userId: user.id })

    return { user, tokens }
  }
}
```

---

### 👤 MODULE USER (Gestion Utilisateurs)

**Responsabilités**:

- CRUD utilisateurs et profils
- Gestion des données métier utilisateur
- Relations avec tenants et rôles
- Préférences utilisateur
- Lifecycle utilisateur

**Modèles Principaux**:

```typescript
// User Model
export default class User extends AuthFinder(BaseModel) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare status: 'active' | 'inactive' | 'suspended'

  // Relations
  @hasOne(() => UserProfile)
  declare profile: HasOne<typeof UserProfile>

  @manyToMany(() => Tenant, { pivotTable: 'user_tenants' })
  declare tenants: ManyToMany<typeof Tenant>

  @manyToMany(() => Role, { pivotTable: 'user_roles' })
  declare roles: ManyToMany<typeof Role>
}

// UserProfile Model
export default class UserProfile extends BaseModel {
  @column()
  declare userId: number

  @column()
  declare firstName: string | null

  @column()
  declare lastName: string | null

  @column()
  declare phone: string | null

  get fullName(): string {
    return `${this.firstName || ''} ${this.lastName || ''}`.trim()
  }
}
```

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

```typescript
export default class TenantMiddleware {
  async handle({ request, response }: HttpContext, next: NextFn) {
    let tenant = null

    // 1. Domaine personnalisé (shop.apple.com)
    const host = request.header('host')
    tenant = await Tenant.findBy('domain', host)

    // 2. Sous-domaine (apple-store.myplatform.com)
    if (!tenant && host.includes('.')) {
      const subdomain = host.split('.')[0]
      tenant = await Tenant.findBy('slug', subdomain)
    }

    // 3. Header X-Tenant-Slug
    if (!tenant) {
      const tenantSlug = request.header('X-Tenant-Slug')
      if (tenantSlug) {
        tenant = await Tenant.findBy('slug', tenantSlug)
      }
    }

    if (!tenant) {
      return response.status(404).json({
        success: false,
        message: 'Tenant not found',
        code: 'TENANT_NOT_FOUND',
      })
    }

    request.ctx.tenant = tenant
    await next()
  }
}
```

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

**Logique Métier**:

```typescript
export default class CartService {
  async addItem(userId: number, tenantId: number, productId: number, quantity: number) {
    // 1. Vérifier le stock disponible
    const inventory = await Inventory.query()
      .where('product_id', productId)
      .where('tenant_id', tenantId)
      .first()

    if (!inventory || inventory.quantity < quantity) {
      throw new InsufficientStockException()
    }

    // 2. Obtenir ou créer le panier
    let cart = await Cart.query()
      .where('user_id', userId)
      .where('tenant_id', tenantId)
      .where('status', 'active')
      .first()

    if (!cart) {
      cart = await Cart.create({ userId, tenantId, status: 'active' })
    }

    // 3. Ajouter ou mettre à jour l'article
    const existingItem = await CartItem.query()
      .where('cart_id', cart.id)
      .where('product_id', productId)
      .first()

    if (existingItem) {
      existingItem.quantity += quantity
      await existingItem.save()
    } else {
      const product = await Product.findOrFail(productId)
      await CartItem.create({
        cartId: cart.id,
        productId,
        quantity,
        price: product.price,
      })
    }

    // 4. Recalculer les totaux
    await this.recalculateCartTotals(cart.id)

    return cart
  }
}
```

---

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

**Service de Commande**:

```typescript
export default class OrderService {
  async createFromCart(userId: number, tenantId: number, orderData: CreateOrderData) {
    return await Database.transaction(async (trx) => {
      // 1. Récupérer le panier actif
      const cart = await Cart.query({ client: trx })
        .where('user_id', userId)
        .where('tenant_id', tenantId)
        .where('status', 'active')
        .preload('items', (query) => query.preload('product'))
        .firstOrFail()

      if (cart.items.length === 0) {
        throw new EmptyCartException()
      }

      // 2. Vérifier les stocks
      for (const item of cart.items) {
        const inventory = await Inventory.query({ client: trx })
          .where('product_id', item.productId)
          .where('tenant_id', tenantId)
          .firstOrFail()

        if (inventory.quantity < item.quantity) {
          throw new InsufficientStockException(`Stock insuffisant pour ${item.product.name}`)
        }
      }

      // 3. Créer la commande
      const orderNumber = await this.generateOrderNumber(tenantId)
      const order = await Order.create(
        {
          userId,
          tenantId,
          orderNumber,
          status: 'pending',
          ...orderData,
          subtotal: cart.subtotal,
          taxAmount: this.calculateTax(cart.subtotal),
          shippingAmount: await this.calculateShipping(orderData.shippingAddress),
          totalAmount: 0, // Calculé après
        },
        { client: trx }
      )

      // 4. Créer les articles de commande
      for (const item of cart.items) {
        await OrderItem.create(
          {
            orderId: order.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.price,
            totalPrice: item.price * item.quantity,
          },
          { client: trx }
        )
      }

      // 5. Mettre à jour les stocks
      for (const item of cart.items) {
        await Inventory.query({ client: trx })
          .where('product_id', item.productId)
          .where('tenant_id', tenantId)
          .decrement('quantity', item.quantity)
      }

      // 6. Marquer le panier comme converti
      cart.status = 'converted'
      await cart.save({ client: trx })

      // 7. Calculer le total final
      order.totalAmount = order.subtotal + order.taxAmount + order.shippingAmount
      await order.save({ client: trx })

      // 8. Émettre les événements
      await emitter.emit('order:created', { orderId: order.id, userId, tenantId })

      return order
    })
  }

  async updateStatus(orderId: number, newStatus: OrderStatus, note?: string) {
    const order = await Order.findOrFail(orderId)
    const oldStatus = order.status

    // Validation des transitions de statut
    const validTransitions = {
      pending: ['paid', 'cancelled'],
      paid: ['processing', 'cancelled'],
      processing: ['shipped', 'cancelled'],
      shipped: ['delivered', 'returned'],
      delivered: ['returned'],
      cancelled: [],
      returned: ['refunded'],
      refunded: [],
    }

    if (!validTransitions[oldStatus].includes(newStatus)) {
      throw new InvalidStatusTransitionException(
        `Cannot transition from ${oldStatus} to ${newStatus}`
      )
    }

    order.status = newStatus

    // Actions spécifiques par statut
    switch (newStatus) {
      case 'shipped':
        order.shippedAt = DateTime.now()
        // Créer automatiquement la livraison
        await this.createDelivery(order)
        break
      case 'delivered':
        order.deliveredAt = DateTime.now()
        break
      case 'cancelled':
        // Remettre les stocks
        await this.restoreInventory(order)
        break
    }

    await order.save()

    // Émettre l'événement de changement de statut
    await emitter.emit('order:status_changed', {
      orderId: order.id,
      oldStatus,
      newStatus,
      note,
    })

    return order
  }
}
```

**Endpoints Critiques**:

- `POST /orders` - Création depuis panier avec validation complète
- `GET /orders/:id` - Détails avec timeline et tracking
- `PUT /orders/:id/status` - Mise à jour statut avec workflow
- `POST /orders/:id/cancel` - Annulation avec remise en stock
- `GET /orders/:id/tracking` - Suivi de livraison

---

## 🗓️ Roadmap de Développement (3 Jours)

### **JOUR 1 - Foundations**

**Objectif**: Base solide pour tout le reste

#### ✅ **Modules à Implémenter**

- **Auth Module Final** (JWT, sécurité, middleware)
- **User Module Complete** (CRUD, profils, relations)
- **Multi-Tenant System** (isolation, contexte, middleware)
- **RBAC System** (rôles, permissions, vérifications)

#### **Livrables Jour 1**

- ✅ API Auth complète et sécurisée
- ✅ Gestion utilisateurs avec profils
- ✅ Système multi-tenant fonctionnel
- ✅ RBAC avec permissions granulaires
- ✅ Documentation API endpoints

---

### **JOUR 2 - E-commerce Core**

**Objectif**: Workflow d'achat complet

#### ✅ **Modules à Implémenter**

- **Catalog System** (produits, catégories, recherche, images)
- **Shopping Cart** (panier, calculs, persistance)
- **Order Management** (workflow, statuts, historique)

#### **Livrables Jour 2**

- ✅ Catalogue produits complet
- ✅ Système de panier fonctionnel
- ✅ Gestion des commandes
- ✅ Workflow commande complète
- ✅ Tests e-commerce flow

---

### **JOUR 3 - Business Features**

**Objectif**: Fonctionnalités business + préparation production

#### ✅ **Modules à Implémenter**

- **Payment System** (paiements, webhooks, remboursements)
- **Delivery Management** (zones, tracking, livreurs)
- **Final Integration** (end-to-end, documentation, audit)

#### **Livrables Jour 3**

- ✅ Système de paiement intégré
- ✅ Gestion complète des livraisons
- ✅ API complète end-to-end
- ✅ Documentation technique
- ✅ Prêt pour le frontend

---

## 🌐 API Documentation Complète

### **71 Endpoints Total**

- **Critical (P0)**: 42 endpoints - Auth, User, Multi-Tenant, Catalog, Cart, Orders
- **High (P1)**: 22 endpoints - RBAC, Payments, Delivery
- **Medium (P2)**: 7 endpoints - Notifications

### **Headers Standard**

```
Authorization: Bearer {token}
Content-Type: application/json
X-Tenant-Slug: apple-store
```

### **Format de Réponse Standard**

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data here
  },
  "meta": {
    "total": 156,
    "perPage": 20,
    "currentPage": 1,
    "lastPage": 8
  }
}
```

### **Gestion d'Erreurs**

```json
{
  "success": false,
  "message": "Error description",
  "code": "ERROR_CODE",
  "errors": [
    {
      "field": "email",
      "message": "Email is required",
      "code": "VALIDATION_ERROR"
    }
  ],
  "timestamp": "2024-01-15T12:00:00Z"
}
```

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

### **Tests d'Intégration** (Must Have - 10% du temps)

```typescript
// Exemple: E-commerce Flow Test
test.group('E-commerce Integration', () => {
  test('complete user journey: registration → login → add to cart → checkout → payment', async ({
    client,
    assert,
  }) => {
    // 1. Registration
    const registrationResponse = await client
      .post('/api/users')
      .json({
        email: 'customer@example.com',
        password: 'password123',
        profile: { firstName: 'John', lastName: 'Doe' },
      })
      .header('X-Tenant-Slug', 'test-store')

    registrationResponse.assertStatus(201)

    // 2. Login
    const loginResponse = await client
      .post('/api/auth/login')
      .json({
        email: 'customer@example.com',
        password: 'password123',
      })
      .header('X-Tenant-Slug', 'test-store')

    loginResponse.assertStatus(200)
    const { accessToken } = loginResponse.body().data.tokens

    // 3. Add to cart
    const addToCartResponse = await client
      .post('/api/cart/items')
      .json({
        productId: 1,
        quantity: 2,
      })
      .header('Authorization', `Bearer ${accessToken}`)
      .header('X-Tenant-Slug', 'test-store')

    addToCartResponse.assertStatus(201)

    // 4. Create order
    const orderResponse = await client
      .post('/api/orders')
      .json({
        shippingAddress: {
          /* address data */
        },
        billingAddress: {
          /* address data */
        },
        shippingMethod: 'standard',
        paymentMethod: 'credit_card',
      })
      .header('Authorization', `Bearer ${accessToken}`)
      .header('X-Tenant-Slug', 'test-store')

    orderResponse.assertStatus(201)
    assert.exists(orderResponse.body().data.order.orderNumber)
  })
})
```

### **Coverage Target**

- **Modules critiques**: 80%+ coverage
- **Services métier**: 90%+ coverage
- **Contrôleurs**: 70%+ coverage
- **Middleware**: 85%+ coverage

---

## 🔧 Outils de Développement

### **Commands Utiles**

```bash
# Générer modules
node ace make:module [name] -m -migration -t -d [domain]

# Base de données
node ace migration:run
node ace db:seed
node ace migration:rollback

# Tests
npm test
npm run test:watch
npm run test:coverage

# Développement
npm run dev
npm run build
npm run start

# Linting & Formatting
npm run lint
npm run format
```

### **Configuration VSCode**

```json
{
  "recommendations": [
    "bradlc.vscode-tailwindcss",
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-typescript-next",
    "formulahendry.auto-rename-tag",
    "christian-kohler.path-intellisense"
  ],
  "settings": {
    "typescript.preferences.importModuleSpecifier": "relative",
    "editor.formatOnSave": true,
    "editor.codeActionsOnSave": {
      "source.fixAll.eslint": true
    }
  }
}
```

### **Scripts Package.json**

```json
{
  "scripts": {
    "dev": "node ace serve --hmr",
    "build": "node ace build",
    "start": "node build/bin/server.js",
    "test": "node ace test",
    "test:watch": "node ace test --watch",
    "test:coverage": "c8 node ace test",
    "lint": "eslint . --ext=.ts,.js",
    "format": "prettier --write .",
    "db:reset": "./reset-db",
    "db:seed": "node ace db:seed",
    "migration:run": "node ace migration:run",
    "migration:rollback": "node ace migration:rollback"
  }
}
```

---

## 🚀 Commandes de Démarrage Rapide

### **1. Installation Initiale**

```bash
# Cloner/initialiser le projet
npm init adonisjs@latest ecommerce-backend
cd ecommerce-backend

# Installer les dépendances
npm install @adonisjs/auth @adonisjs/lucid @adonisjs/cors
npm install @maximemrf/adonisjs-jwt bcryptjs
npm install --save-dev @types/bcryptjs

# Configuration initiale
cp .env.example .env
node ace generate:key
```

### **2. Configuration Base de Données**

```bash
# Créer la base de données
createdb ecommerce_db

# Configurer .env
echo "DB_DATABASE=ecommerce_db" >> .env
echo "JWT_SECRET=$(node -e 'console.log(require("crypto").randomBytes(64).toString("hex"))')" >> .env

# Lancer les migrations
node ace migration:run
node ace db:seed
```

### **3. Développement**

```bash
# Lancer en mode développement
npm run dev

# Dans un autre terminal - tests
npm run test:watch

# Lancer les seeds de test
node ace db:seed --files database/seeders/test_data_seeder.ts
```

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

---

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

**Prêt pour**:

- ✅ Développement frontend (React, Vue, Angular)
- ✅ Applications mobiles (React Native, Flutter)
- ✅ Intégrations tiers (Stripe, PayPal, etc.)
- ✅ Déploiement production (Docker, Kubernetes)
- ✅ Monitoring et analytics

**Let's build this amazing e-commerce platform! 🚀**
