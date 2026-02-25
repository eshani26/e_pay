<?php
/**
 * Database Configuration File
 * Handles PDO connection and database initialization
 */

class Database {
    private $host;
    private $db_name;
    private $username;
    private $password;
    private $conn;

    public function __construct() {
        // Load from environment variables or use defaults
        $this->host = getenv('DB_HOST') ?: 'localhost';
        $this->db_name = getenv('DB_NAME') ?: 'auditorium_booking';
        $this->username = getenv('DB_USER') ?: 'root';
        $this->password = getenv('DB_PASS') ?: '';
    }

    /**
     * Get database connection
     * @return PDO Database connection object
     * @throws Exception if connection fails
     */
    public function getConnection() {
        // Return existing connection if available
        if ($this->conn !== null) {
            return $this->conn;
        }

        try {
            $dsn = "mysql:host={$this->host};dbname={$this->db_name};charset=utf8mb4";
            $this->conn = new PDO($dsn, $this->username, $this->password);
            
            // Set PDO error mode to exception
            $this->conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
            
            // Set default fetch mode to associative array
            $this->conn->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
            
            // Disable emulated prepared statements for security
            $this->conn->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
            
            return $this->conn;
        } catch(PDOException $e) {
            // Log error securely, don't expose to users
            error_log("Database connection failed: " . $e->getMessage());
            throw new Exception("Database connection failed. Please try again later.");
        }
    }

    /**
     * Close database connection
     */
    public function closeConnection() {
        $this->conn = null;
    }

    /**
     * Create tables if they don't exist
     */
    public function createTables() {
        $pdo = $this->getConnection();

        // Create auditoriums table
        $auditoriums_sql = "
            CREATE TABLE IF NOT EXISTS auditoriums (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(100) NOT NULL UNIQUE,
                capacity INT NOT NULL,
                facilities VARCHAR(500),
                location VARCHAR(100),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ";

        // Create bookings table
        $bookings_sql = "
            CREATE TABLE IF NOT EXISTS bookings (
                id INT PRIMARY KEY AUTO_INCREMENT,
                auditorium_id INT NOT NULL,
                reservation_date DATE NOT NULL,
                check_in_time TIME NOT NULL,
                check_out_time TIME NOT NULL,
                requested_by VARCHAR(100) NOT NULL,
                contact_email VARCHAR(100),
                contact_phone VARCHAR(15),
                department VARCHAR(100),
                designation VARCHAR(100),
                nature_of_programme TEXT,
                expected_attendees INT,
                facilities_required VARCHAR(500),
                total_fee DECIMAL(10, 2),
                status ENUM('pending', 'approved', 'rejected', 'cancelled') DEFAULT 'pending',
                approved_by VARCHAR(100),
                approval_date DATETIME,
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (auditorium_id) REFERENCES auditoriums(id),
                UNIQUE KEY unique_booking (auditorium_id, reservation_date, check_in_time)
            )
        ";

        // Create facilities table
        $facilities_sql = "
            CREATE TABLE IF NOT EXISTS facilities (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(100) NOT NULL UNIQUE,
                fee DECIMAL(10, 2) NOT NULL,
                description TEXT,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ";

        // Create booking_facilities junction table
        $booking_facilities_sql = "
            CREATE TABLE IF NOT EXISTS booking_facilities (
                id INT PRIMARY KEY AUTO_INCREMENT,
                booking_id INT NOT NULL,
                facility_id INT NOT NULL,
                quantity INT DEFAULT 1,
                fee DECIMAL(10, 2),
                FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
                FOREIGN KEY (facility_id) REFERENCES facilities(id),
                UNIQUE KEY unique_booking_facility (booking_id, facility_id)
            )
        ";

        // Create users table
        $users_sql = "
            CREATE TABLE IF NOT EXISTS users (
                id INT PRIMARY KEY AUTO_INCREMENT,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(100) UNIQUE NOT NULL,
                phone VARCHAR(15),
                department VARCHAR(100),
                designation VARCHAR(100),
                post_office_code VARCHAR(20),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ";

        try {
            $pdo->exec($auditoriums_sql);
            $pdo->exec($bookings_sql);
            $pdo->exec($facilities_sql);
            $pdo->exec($booking_facilities_sql);
            $pdo->exec($users_sql);
            
            error_log("Tables created successfully");
            return true;
        } catch(PDOException $e) {
            error_log("Error creating tables: " . $e->getMessage());
            return false;
        }
    }
}

?>