<?php
/**
 * booking_handler.php
 * Handles booking application submissions and validation
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Only allow POST requests
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method Not Allowed']);
    exit;
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
$action = $_POST['action'] ?? '';

switch ($action) {
    case 'submit_booking':
        submitBooking($pdo);
        break;

    case 'cancel_booking':
        cancelBooking($pdo);
        break;

    case 'check_availability':
        checkAvailability($pdo);
        break;

    default:
        http_response_code(400);
        echo json_encode(['error' => 'Invalid action']);
        break;
}

/**
 * Submit a new booking application
 */
function submitBooking($pdo) {
    // Validate and sanitize inputs
    $errors = [];

    // Required fields
    $reservationDate = $_POST['reservation_date'] ?? null;
    $auditoriumId = $_POST['auditorium_id'] ?? null;
    $checkInTime = $_POST['check_in_time'] ?? null;
    $checkOutTime = $_POST['check_out_time'] ?? null;
    $requestedBy = $_POST['requested_by'] ?? null;
    $contactEmail = $_POST['contact_email'] ?? null;
    $contactPhone = $_POST['contact_phone'] ?? null;
    $department = $_POST['department'] ?? null;
    $designation = $_POST['designation'] ?? null;
    $natureOfProgramme = $_POST['nature_of_programme'] ?? null;
    $expectedAttendees = $_POST['expected_attendees'] ?? 0;
    $totalFee = $_POST['total_fee'] ?? 0;

    // Optional fields
    $facilitiesRequired = $_POST['facilities_required'] ?? null;

    // Validation
    if (!$reservationDate || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $reservationDate)) {
        $errors[] = 'Invalid reservation date';
    }

    if (!$auditoriumId || !is_numeric($auditoriumId)) {
        $errors[] = 'Invalid auditorium selected';
    }

    if (!$checkInTime || !preg_match('/^\d{2}:\d{2}$/', $checkInTime)) {
        $errors[] = 'Invalid check-in time';
    }

    if (!$checkOutTime || !preg_match('/^\d{2}:\d{2}$/', $checkOutTime)) {
        $errors[] = 'Invalid check-out time';
    }

    if ($checkInTime >= $checkOutTime) {
        $errors[] = 'Check-out time must be after check-in time';
    }

    if (!$requestedBy || strlen($requestedBy) < 3) {
        $errors[] = 'Invalid name provided';
    }

    if (!$contactEmail || !filter_var($contactEmail, FILTER_VALIDATE_EMAIL)) {
        $errors[] = 'Invalid email address';
    }

    if (!$contactPhone || !preg_match('/^\d{10,15}$/', str_replace([' ', '-'], '', $contactPhone))) {
        $errors[] = 'Invalid phone number';
    }

    if (!$department || strlen($department) < 2) {
        $errors[] = 'Invalid department';
    }

    if (!$designation || strlen($designation) < 2) {
        $errors[] = 'Invalid designation';
    }

    if (!$natureOfProgramme || strlen($natureOfProgramme) < 10) {
        $errors[] = 'Please provide details about the programme';
    }

    if (!is_numeric($expectedAttendees) || $expectedAttendees <= 0) {
        $errors[] = 'Invalid number of attendees';
    }

    // Check booking date is in future and at least 3 days away
    $today = new DateTime();
    $bookingDate = DateTime::createFromFormat('Y-m-d', $reservationDate);
    
    if ($bookingDate === false) {
        $errors[] = 'Invalid date format';
    } else {
        $daysAhead = $today->diff($bookingDate)->days;
        if ($bookingDate < $today) {
            $errors[] = 'Cannot book a date in the past';
        } elseif ($daysAhead < 3) {
            $errors[] = 'Bookings must be made at least 3 days in advance';
        }
    }

    // Return validation errors
    if (!empty($errors)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'errors' => $errors]);
        return;
    }

    try {
        // Check if auditorium exists
        $audStmt = $pdo->prepare("SELECT id, capacity FROM auditoriums WHERE id = ? AND is_active = TRUE");
        $audStmt->execute([$auditoriumId]);
        
        if ($audStmt->rowCount() === 0) {
            throw new Exception('Selected auditorium not found');
        }

        $auditorium = $audStmt->fetch(PDO::FETCH_ASSOC);

        // Check expected attendees doesn't exceed capacity
        if ($expectedAttendees > $auditorium['capacity']) {
            throw new Exception('Expected attendees exceeds auditorium capacity');
        }

        // Check for conflicting bookings
        $conflictStmt = $pdo->prepare("
            SELECT id FROM bookings 
            WHERE auditorium_id = ? 
            AND reservation_date = ? 
            AND status IN ('approved', 'pending')
            AND (
                (check_in_time < ? AND check_out_time > ?) OR
                (check_in_time >= ? AND check_in_time < ?)
            )
        ");

        $conflictStmt->execute([
            $auditoriumId,
            $reservationDate,
            $checkOutTime,
            $checkInTime,
            $checkInTime,
            $checkOutTime
        ]);

        if ($conflictStmt->rowCount() > 0) {
            throw new Exception('Selected time slot is already booked');
        }

        // Insert booking
        $insertStmt = $pdo->prepare("
            INSERT INTO bookings (
                auditorium_id, reservation_date, check_in_time, check_out_time,
                requested_by, contact_email, contact_phone, department, designation,
                nature_of_programme, expected_attendees, facilities_required, total_fee, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
        ");

        $insertStmt->execute([
            $auditoriumId,
            $reservationDate,
            $checkInTime,
            $checkOutTime,
            $requestedBy,
            $contactEmail,
            $contactPhone,
            $department,
            $designation,
            $natureOfProgramme,
            $expectedAttendees,
            $facilitiesRequired,
            $totalFee
        ]);

        $bookingId = $pdo->lastInsertId();

        // Send confirmation email
        $subject = "Auditorium Booking Application Received - Reference #" . $bookingId;
        $message = "Dear " . htmlspecialchars($requestedBy) . ",\n\n";
        $message .= "Your auditorium booking application has been received successfully.\n\n";
        $message .= "Reference Number: " . $bookingId . "\n";
        $message .= "Status: Pending Review\n\n";
        $message .= "Your application will be reviewed and you will receive approval status via email.\n\n";
        $message .= "Thank you,\nAuditorium Booking System";

        $headers = "From: noreply@auditoriumbooking.local\r\n";
        $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

        mail($contactEmail, $subject, $message, $headers);

        http_response_code(201);
        echo json_encode([
            'success' => true,
            'message' => 'Booking application submitted successfully',
            'bookingId' => $bookingId,
            'reference' => 'REF-' . str_pad($bookingId, 6, '0', STR_PAD_LEFT)
        ]);

    } catch (Exception $e) {
        error_log("Error submitting booking: " . $e->getMessage());
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

/**
 * Cancel an existing booking
 */
function cancelBooking($pdo) {
    $bookingId = $_POST['booking_id'] ?? null;
    $cancellationReason = $_POST['reason'] ?? 'No reason provided';

    if (!$bookingId || !is_numeric($bookingId)) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid booking ID']);
        return;
    }

    try {
        // Get booking details
        $stmt = $pdo->prepare("
            SELECT id, requested_by, contact_email, reservation_date, status
            FROM bookings 
            WHERE id = ?
        ");
        $stmt->execute([$bookingId]);

        if ($stmt->rowCount() === 0) {
            throw new Exception('Booking not found');
        }

        $booking = $stmt->fetch(PDO::FETCH_ASSOC);

        // Check if booking can be cancelled (48 hours before)
        $reservationDate = new DateTime($booking['reservation_date']);
        $now = new DateTime();
        $hoursUntil = $now->diff($reservationDate)->h + ($now->diff($reservationDate)->days * 24);

        if ($hoursUntil < 48 && $booking['status'] === 'approved') {
            throw new Exception('Cancellation requires 48 hours notice before booking date');
        }

        // Update booking status
        $updateStmt = $pdo->prepare("UPDATE bookings SET status = 'cancelled' WHERE id = ?");
        $updateStmt->execute([$bookingId]);

        // Send cancellation email
        $subject = "Auditorium Booking Cancelled - Reference #" . $bookingId;
        $message = "Dear " . htmlspecialchars($booking['requested_by']) . ",\n\n";
        $message .= "Your auditorium booking has been cancelled.\n\n";
        $message .= "Booking Reference: REF-" . str_pad($bookingId, 6, '0', STR_PAD_LEFT) . "\n";
        $message .= "Cancellation Reason: " . htmlspecialchars($cancellationReason) . "\n\n";
        $message .= "Any refundable deposits will be processed within 7 business days.\n\n";
        $message .= "Thank you,\nAuditorium Booking System";

        $headers = "From: noreply@auditoriumbooking.local\r\n";
        $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

        mail($booking['contact_email'], $subject, $message, $headers);

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'message' => 'Booking cancelled successfully'
        ]);

    } catch (Exception $e) {
        error_log("Error cancelling booking: " . $e->getMessage());
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}

/**
 * Check availability (simpler version for quick checks)
 */
function checkAvailability($pdo) {
    $auditoriumId = $_POST['auditorium_id'] ?? null;
    $date = $_POST['date'] ?? null;
    $checkInTime = $_POST['check_in_time'] ?? null;
    $checkOutTime = $_POST['check_out_time'] ?? null;

    if (!$auditoriumId || !$date || !$checkInTime || !$checkOutTime) {
        http_response_code(400);
        echo json_encode(['error' => 'Missing required parameters']);
        return;
    }

    try {
        $stmt = $pdo->prepare("
            SELECT COUNT(*) as conflicts FROM bookings 
            WHERE auditorium_id = ? 
            AND reservation_date = ? 
            AND status IN ('approved', 'pending')
            AND (
                (check_in_time < ? AND check_out_time > ?) OR
                (check_in_time >= ? AND check_in_time < ?)
            )
        ");

        $stmt->execute([$auditoriumId, $date, $checkOutTime, $checkInTime, $checkInTime, $checkOutTime]);
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        $isAvailable = $result['conflicts'] === 0;

        http_response_code(200);
        echo json_encode([
            'success' => true,
            'available' => $isAvailable,
            'conflicts' => $result['conflicts']
        ]);

    } catch (PDOException $e) {
        error_log("Error checking availability: " . $e->getMessage());
        http_response_code(500);
        echo json_encode(['error' => 'Failed to check availability']);
    }
}

?>