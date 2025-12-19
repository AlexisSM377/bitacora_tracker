<?php
// guardar_informe.php
error_reporting(E_ALL);
ini_set('display_errors', 1);
header('Content-Type: application/json; charset=utf-8');

try {
    require 'db.php';
    // Verificar método
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception("Método no permitido. Use POST.");
    }
    
    // Leer datos JSON
    $json_data = file_get_contents('php://input');
    $data = json_decode($json_data, true);
    
    // Si no vienen como JSON, intentar con POST normal
    if (!$data) {
        $data = $_POST;
    }
    
    // Validar datos requeridos
    $titulo = $data['titulo'] ?? null;
    $datos_informe = $data['datos_informe'] ?? null;
    
    if (!$titulo || !$datos_informe) {
        throw new Exception("Faltan datos requeridos: título y datos del informe son obligatorios");
    }
    
    // Preparar datos
    $fecha_despacho = $data['fecha_despacho'] ?? date('Y-m-d');
    $total_despachos = intval($data['total_despachos'] ?? 0);
    $a_tiempo = intval($data['a_tiempo'] ?? 0);
    $con_retraso = intval($data['con_retraso'] ?? 0);
    $en_ruta = intval($data['en_ruta'] ?? 0);
    $programados = intval($data['programados'] ?? 0);
    $total_incidencias = intval($data['total_incidencias'] ?? 0);
    $operador_monitoreo = $data['operador_monitoreo'] ?? 'Desconocido';
    
    // Asegurar que datos_informe sea un string JSON válido
    if (is_array($datos_informe)) {
        $datos_informe = json_encode($datos_informe, JSON_UNESCAPED_UNICODE);
    }
    
    // Preparar consulta
    $sql = "INSERT INTO informes_guardados 
        (titulo, fecha_despacho, total_despachos, a_tiempo, con_retraso, en_ruta, programados, total_incidencias, datos_informe, operador_monitoreo) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    
    $stmt = $conn->prepare($sql);
    
    if (!$stmt) {
        throw new Exception("Error en la preparación: " . $conn->error);
    }
    
    $stmt->bind_param("ssiiiiisss", 
        $titulo, 
        $fecha_despacho, 
        $total_despachos, 
        $a_tiempo, 
        $con_retraso, 
        $en_ruta, 
        $programados, 
        $total_incidencias, 
        $datos_informe, 
        $operador_monitoreo
    );
    
    if ($stmt->execute()) {
        $response = [
            'success' => true,
            'message' => 'Informe guardado correctamente',
            'id' => $stmt->insert_id
        ];
        echo json_encode($response, JSON_UNESCAPED_UNICODE);
    } else {
        throw new Exception("Error al ejecutar: " . $stmt->error);
    }
    
    $stmt->close();
    
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error: ' . $e->getMessage()
    ], JSON_UNESCAPED_UNICODE);
} finally {
    if (isset($conn) && $conn) {
        $conn->close();
    }
}
?>