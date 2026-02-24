<?php
/**
 * get_data.php
 * Handles API requests to fetch available auditoriums and booking data
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Prevent direct access
if (php_sapi_name() === 'cli') {
    exit('Direct access not allowed');
}

require_once 'config.php';

try {
    $database = new Database();
    $pdo = $database->getConnection();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

// Determine the action
$action = $_GET['action'] ?? '';

switch ($action) {
    case 'get_auditoriums':
        getAuditoriums($pdo);
        break;

    case 'get_availability':
        getAvailability($pdo);
        break;

    case 'get_booked_dates':
        getBookedDates($pdo);
        break;

    case 'get_facilities':
        getFacilities($pdo);
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
        break;
}

/**
 * Get all active auditoriums
 */
function getAuditoriums($pdo) {
    try {
        $stmt = $pdo->query("
            SELECT id, name, capacity, facilities, location 
            FROM auditoriums 
            WHERE is_active = TRUE 
            ORDER BY name ASC
        ");
        
        $auditoriums = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'data' => $auditoriums]);
    } catch (PDOException $e) {
        error_log("Error fetching auditoriums: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch auditoriums']);
    }
}

/**
 * Check availability of auditoriums for given date and time
 * GET parameters: date, check_in_time, check_out_time
 */
function getAvailability($pdo) {
    $date = $_GET['date'] ?? null;
    $check_in = $_GET['check_in_time'] ?? null;
    $check_out = $_GET['check_out_time'] ?? null;

    // Validate inputs
    if (!$date || !$check_in || !$check_out) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required parameters']);
        return;
    }

    // Validate date format
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid date format']);
        return;
    }

    try {
        // Get all auditoriums
        $stmt = $pdo->query("
            SELECT id, name, capacity, facilities, location 
            FROM auditoriums 
            WHERE is_active = TRUE 
            ORDER BY name ASC
        ");
        
        $auditoriums = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $availableAuditoriums = [];

        // Check each auditorium for conflicts
        foreach ($auditoriums as $auditorium) {
            $auditorium['available'] = true;
            $auditorium['bookedBy'] = null;
            $auditorium['bookedTime'] = null;

            // Check for overlapping bookings
            $conflictStmt = $pdo->prepare("
                SELECT id, requested_by, check_in_time, check_out_time 
                FROM bookings 
                WHERE auditorium_id = ? 
                AND reservation_date = ? 
                AND status IN ('approved', 'pending')
                AND (
                    (check_in_time < ? AND check_out_time > ?) OR
                    (check_in_time >= ? AND check_in_time < ?)
                )
            ");

            $conflictStmt->execute([
                $auditorium['id'],
                $date,
                $check_out,
                $check_in,
                $check_in,
                $check_out
            ]);

            if ($conflictStmt->rowCount() > 0) {
                $conflict = $conflictStmt->fetch(PDO::FETCH_ASSOC);
                $auditorium['available'] = false;
                $auditorium['bookedBy'] = $conflict['requested_by'];
                $auditorium['bookedTime'] = $conflict['check_in_time'] . ' - ' . $conflict['check_out_time'];
            }

            $availableAuditoriums[] = $auditorium;
        }

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'date' => $date,
            'check_in' => $check_in,
            'check_out' => $check_out,
            'data' => $availableAuditoriums
        ]);
    } catch (PDOException $e) {
        error_log("Error checking availability: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to check availability']);
    }
}

/**
 * Get booked dates for calendar display
 * GET parameters: auditorium_id (optional)
 */
function getBookedDates($pdo) {
    $auditoriumId = $_GET['auditorium_id'] ?? null;

    try {
        if ($auditoriumId) {
            // Get bookings for specific auditorium
            $stmt = $pdo->prepare("
                SELECT 
                    b.id, 
                    b.reservation_date as date,
                    b.check_in_time,
                    b.check_out_time,
                    b.requested_by as bookedBy,
                    a.name as auditorium_name
                FROM bookings b
                JOIN auditoriums a ON b.auditorium_id = a.id
                WHERE b.auditorium_id = ? 
                AND b.status IN ('approved', 'pending')
                AND b.reservation_date >= DATE(NOW())
                ORDER BY b.reservation_date ASC
            ");
            $stmt->execute([$auditoriumId]);
        } else {
            // Get bookings for all auditoriums
            $stmt = $pdo->query("
                SELECT 
                    b.id,
                    b.reservation_date as date,
                    b.check_in_time,
                    b.check_out_time,
                    b.requested_by as bookedBy,
                    a.name as auditorium_name
                FROM bookings b
                JOIN auditoriums a ON b.auditorium_id = a.id
                WHERE b.status IN ('approved', 'pending')
                AND b.reservation_date >= DATE(NOW())
                ORDER BY b.reservation_date ASC, a.name ASC
            ");
        }

        $bookings = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Format bookings by auditorium and date
        $bookedDates = [];
        foreach ($bookings as $booking) {
            $audName = $booking['auditorium_name'];
            $dateStr = $booking['date'];
            
            if (!isset($bookedDates[$audName])) {
                $bookedDates[$audName] = [];
            }

            $bookedDates[$audName][] = [
                'date' => $dateStr,
                'bookedBy' => $booking['bookedBy'],
                'time' => $booking['check_in_time'] . '-' . $booking['check_out_time']
            ];
        }

        http_response_code(200);
        echo json_encode(['success' => true, 'data' => $bookedDates]);
    } catch (PDOException $e) {
        error_log("Error fetching booked dates: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch booked dates']);
    }
}

/**
 * Get available facilities with their fees
 */
function getFacilities($pdo) {
    try {
        $stmt = $pdo->query("
            SELECT id, name, fee, description 
            FROM facilities 
            WHERE is_active = TRUE 
            ORDER BY name ASC
        ");

        $facilities = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'data' => $facilities]);
    } catch (PDOException $e) {
        error_log("Error fetching facilities: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to fetch facilities']);
    }
}

?>